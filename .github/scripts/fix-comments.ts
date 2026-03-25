import Groq from "groq-sdk";
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const owner = process.env.REPO_OWNER as string;
const repo = process.env.REPO_NAME as string;
const prNumber = parseInt(process.env.PR_NUMBER as string);
const branch = process.env.BRANCH as string;

interface Issue {
  line: number;
  body: string;
}
interface FileIssues {
  [filePath: string]: Issue[];
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

  //step 2: group comments by files

  const byFile: FileIssues = {};
  for (const comment of coderabbitComments) {
    if (!byFile[comment.path]) byFile[comment.path] = [];
    byFile[comment.path].push({
      line: comment.line ?? 0,
      body: comment.body,
    });
  }

  const fixedFiles: string[] = [];

  //step 3.fix each file
  for (const [filePath, issues] of Object.entries(byFile)) {
    console.log(`🕖 Processing ${filePath} — ${issues.length} issue(s)`);

    try {
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

      const fileContent = Buffer.from(fileData.content, "base64").toString(
        "utf8",
      );

      // format issues
      const issueList = issues
        .map((issue, i) => {
          `Issue ${i + 1} at line ${issue.line}:\n ${issue.body}`;
        })
        .join("\n\n----\n\n");

      //send groq to fixing
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_completion_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are an expert software developer.
                        Fix the issues provided in the file.
                        Return ONLY the complete fixed file content.
                        No explanations. No markdown backticks. Raw code only.`,
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

      //push file back to github

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `fix: address CodeRabbit comments in ${filePath}`,
        content: Buffer.from(fixedContent).toString("base64"),
        sha: fileData.sha,
        branch,
      });

      fixedFiles.push(filePath);
      console.log(`✅ Fixed and pushed ${filePath}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Failed to fix ${filePath}: ${error.message}`);
      }
    }
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
