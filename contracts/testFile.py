def test(text: str) -> None:
    assert isinstance(text, str), "Input must be a string"
    print(text)