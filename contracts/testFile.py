def test(text: str) -> None:
    assert isinstance(text, str), "Input must be a string"
    print(text)

def main() -> None:
    test("Hello, World!")

if __name__ == "__main__":
    main()