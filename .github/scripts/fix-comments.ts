import Groq from "groq-sdk";
import { Octokit } from "octokit";
import * as fs from "fs";
import * as path from "path";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const owner = process.env.REPO_OWNER as string;
const repo = process.env.REPO_NAME as string;
const prNumber = parseInt(process.env.PR_NUMBER as string);
const branch = process.env.BRANCH as string;
const repoRoot = process.env.REPO_ROOT as string;

interface Issue {
  line: number;
  body: string;
  comment_id: number;
}
interface FileIssues {
  [filePath: string]: Issue[];
}

async function getThreadIds(): Promise<Map<number, string>> {
  const threadMap = new Map<number, string>();

  const query = `
      query getThreads($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 1) {
                nodes {
                  databaseId
                }
              }
            }
          }
        }
      }
    }
    `;

  const result: any = await octokit.graphql(query, {
    owner,
    repo,
    prNumber,
  });

  const threads = result.repository.pullRequest.reviewThreads.nodes;
  for (const thread of threads) {
    if (thread.comments.nodes.length > 0) {
      const commentId = thread.comments.nodes[0].databaseId;
      threadMap.set(commentId, thread.id);
    }
  }

  return threadMap;
}

async function run(): Promise<void> {
  console.log(`🔂 Starting auto fix for PR #${prNumber} on branch ${branch}`);

  //step 1 - get all Coderabbit comments

  const { data: comments } = await octokit.rest.pulls.listReviewComments({
    owner,
    repo,
    pull_number: prNumber,
  });

  const coderabbitComments = comments.filter((c: any) =>
    c.user.login.includes("coderabbit"),
  );

  if (coderabbitComments.length === 0) {
    console.log("⚠️ No CodeRabbit comments found — nothing to fix");
    return;
  }

  console.log(`📥 Found ${coderabbitComments.length} CodeRabbit comments`);

  const threadMap = await getThreadIds();

  //step 2: group comments by files
  const byFile: FileIssues = {};
  for (const comment of coderabbitComments) {
    if (!byFile[comment.path]) byFile[comment.path] = [];
    byFile[comment.path].push({
      line: comment.line ?? 0,
      body: comment.body,
      comment_id: comment.id,
    });
  }

  const fixedFiles: string[] = [];

  //step 3.fix each file
  for (const [filePath, issues] of Object.entries(byFile)) {
    console.log(`🕖 Processing ${filePath} — ${issues.length} issue(s)`);

    try {
      const localPath = path.join(repoRoot, filePath);
      console.log("📁 fixing file at ", localPath);
      const fileContent = fs.readFileSync(localPath, "utf8");

      // read file from Github
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch,
      });

      if (Array.isArray(fileData) || fileData.type !== "file") {
        console.error(`❌ ${filePath} is not a file — skipping`);
        continue;
      }

      // format issues
      const issueList = issues
        .map((issue, i) => {
          `Issue ${i + 1} at line ${issue.line}:\n ${issue.body}`;
        })
        .join("\n\n----\n\n");

      //send groq to fixing
      const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        max_completion_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are an expert software developer.
                        Fix the issues provided in the file.
                        CRITICAL RULES:                        
                        - Return ONLY the raw file content
                        - Do NOT wrap in markdown code blocks
                        - Do NOT use backticks
                        - Do NOT add any explanation
                        - Start your response with the first line of code
                        - End your response with the last line of code
                        ALWAYS:
                        - test must be passed   
                        -If any tests fail fix them and run again
                            Keep fixing and running until all tests pass
                            Do not stop until you see 0 failing  
                        `,
          },
          {
            role: "user",
            content: `FILE PATH ${filePath}
            
                      CURRENT FILE CONTENT: ${fileContent}
                      
                      ISSUES TO FIX: ${issueList}
            `,
          },
        ],
      });

      const fixedContent = response.choices[0].message.content;

      if (!fixedContent) {
        console.error(`❌ No content returned from Groq for ${filePath}`);
        continue;
      }

      // write to the localfile
      fs.writeFileSync(localPath, fixedContent, "utf8");

      fixedFiles.push(filePath);
      console.log(`✅ Fixed and pushed ${filePath}`);

      console.log(`Done — fixed ${fixedFiles.length} files`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Failed to fix ${filePath}: ${error.message}`);
      }
    }
  }

  // if (fixedFiles.length > 0) {
  //   await octokit.rest.issues.createComment({
  //     owner,
  //     repo,
  //     issue_number: prNumber,
  //     body: [
  //       "## Auto Fix Complete ✅",
  //       "",
  //       `Fixed **${fixedFiles.length}** file(s) based on CodeRabbit comments.`,
  //       "",
  //       "**Files fixed:**",
  //       ...fixedFiles.map((f) => `- \`${f}\``),
  //       "",
  //       "CodeRabbit will re-review shortly.",
  //     ].join("\n"),
  //   });
  // }

  if (fixedFiles.length === 0) {
    console.log("⚠️ No files were fixed — skipping commit and review trigger");
    process.exit(0);
  }

  // after fixing the file — reply to each comment
  for (const comment of coderabbitComments) {
    if (fixedFiles.includes(comment.path)) {
      //reply to comment
      try {
        await octokit.rest.pulls.createReplyForReviewComment({
          owner,
          repo,
          pull_number: prNumber,
          comment_id: comment.id,
          body: `✅ Fixed in commit \`fix: address CodeRabbit comments\``,
        });

        console.log(`💬 Replied to comment ${comment.id}`);

        //resolve the thread
        const threadId = threadMap.get(comment.id);
        if (threadId) {
          await octokit.graphql(
            `
          mutation resolveThread($threadId: ID!) {
            resolveReviewThread(input: { threadId: $threadId }) {
              thread {
                id
                isResolved
              }
            }
          }
        `,
            { threadId },
          );
        }
        console.log(`✔️ Resolved thread for comment ${comment.id}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `❌ Failed to reply/resolve comment ${comment.id}: ${error.message}`,
          );
        }
      }
    }
  }

  if (fixedFiles.length > 0) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: [
        "## Auto Fix Complete ✅",
        "",
        `Fixed **${fixedFiles.length}** file(s) based on CodeRabbit comments.`,
        "",
        "**Files fixed:**",
        ...fixedFiles.map((f) => `- \`${f}\``),
        "",
        "coderabbit ai will review soon..",
        "",
        "@coderabbitai review",
      ].join("\n"),
    });
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
