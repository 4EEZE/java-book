use std::{fs, process::Command};
use tempfile::TempDir;

use crate::{SpannedValue, SpannedValueExt, Validate, ValidationContext, cxensure, tomlcast};
use mdbook_quiz_schema::*;

/// Маркер, который односоставный запуск `java` печатает в stderr, когда
/// программа не скомпилировалась. Отличает ошибку компиляции от исключения
/// во время выполнения: в обоих случаях код возврата ненулевой.
const COMPILE_FAILURE_MARKER: &str = "error: compilation failed";

impl Validate for Tracing {
  fn validate(&self, cx: &mut ValidationContext, value: &SpannedValue) {
    let QuestionFields {
      prompt: TracingPrompt { program },
      answer,
      ..
    } = &self.0;
    let mut inner = || -> anyhow::Result<()> {
      let dir = TempDir::new()?;

      // Имя файла произвольное: запуск исходника через `java <файл>`, в
      // отличие от `javac`, не требует совпадения с именем публичного класса.
      // Благодаря этому одинаково работают и компактные файлы с `void main()`,
      // и классическая форма с `public class`.
      let src_path = dir.path().join("Main.java");
      fs::write(&src_path, program)?;

      let output = Command::new("java")
        .arg(&src_path)
        .current_dir(dir.path())
        .output()?;

      let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
      let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
      let answer_val = tomlcast!(value.table["answer"]);

      // `java` компилирует и запускает за один шаг, поэтому фазы разделяем по
      // маркеру: всё остальное означает, что программа собралась и запустилась.
      let compiles = !stderr.contains(COMPILE_FAILURE_MARKER);

      if compiles {
        cxensure!(
          cx,
          answer.does_compile,
          labels = vec![tomlcast!(answer_val.table["doesCompile"]).labeled_span()],
          "program compiles but doesCompile = false",
        );

        cxensure!(
          cx,
          answer.stdout.is_some(),
          labels = vec![answer_val.labeled_span()],
          "program compiles but stdout is missing"
        );

        cxensure!(
          cx,
          output.status.success(),
          labels = vec![answer_val.labeled_span()],
          "program fails when executed. stderr:\n{}",
          textwrap::indent(&stderr, "  ")
        );

        // `cxensure!` только записывает ошибку и не прерывает проверку, так
        // что сюда можно дойти и с отсутствующим stdout — сравниваем лишь
        // когда он задан, иначе получили бы панику вместо внятной ошибки.
        if let Some(expected_stdout) = &answer.stdout {
          cxensure!(
            cx,
            stdout.trim() == expected_stdout.trim(),
            labels = vec![tomlcast!(answer_val.table["stdout"]).labeled_span()],
            "expected stdout:\n{}\ndid not match actual stdout:\n{}",
            textwrap::indent(expected_stdout, "  "),
            textwrap::indent(&stdout, "  ")
          );
        }
      } else {
        cxensure!(
          cx,
          !answer.does_compile,
          labels = vec![tomlcast!(answer_val.table["doesCompile"]).labeled_span()],
          "program does not compile but doesCompile = true. javac stderr:\n{}",
          textwrap::indent(&stderr, "  ")
        );

        cxensure!(
          cx,
          answer.stdout.is_none(),
          labels = vec![answer_val.labeled_span()],
          "program does not compile but contains a stdout key"
        );
      }

      Ok(())
    };
    inner().unwrap();
  }
}

#[test]
fn validate_tracing_passes() {
  let contents = r#"
[[questions]]
type = "Tracing"
prompt.program = """
void main() {
  IO.println("Hello world");
}
"""
answer.doesCompile = true
answer.stdout = "Hello world"
"#;
  assert!(crate::test::harness(contents).is_ok());
}

#[test]
fn validate_tracing_passes_classic_form() {
  // Классическая форма с именем класса, не совпадающим с именем файла.
  let contents = r#"
[[questions]]
type = "Tracing"
prompt.program = """
public class Greeter {
  public static void main(String[] args) {
    System.out.println("Hello world");
  }
}
"""
answer.doesCompile = true
answer.stdout = "Hello world"
"#;
  assert!(crate::test::harness(contents).is_ok());
}

#[test]
fn validate_tracing_compile_fail() {
  let contents = r#"
[[questions]]
type = "Tracing"
prompt.program = """
void main() {
  int x = "строка";
}
"""
answer.doesCompile = true
answer.stdout = ""
"#;
  assert!(crate::test::harness(contents).is_err());
}

#[test]
fn validate_tracing_runtime_error_is_not_compile_error() {
  // Программа компилируется, но падает при выполнении: это не то же самое,
  // что ошибка компиляции, и валидатор обязан их различать.
  let contents = r#"
[[questions]]
type = "Tracing"
prompt.program = """
void main() {
  throw new RuntimeException("бум");
}
"""
answer.doesCompile = false
"#;
  assert!(crate::test::harness(contents).is_err());
}

#[test]
fn validate_tracing_wrong_stdout() {
  let contents = r#"
[[questions]]
type = "Tracing"
prompt.program = """
void main() {
  IO.println("Hello world");
}
"""
answer.doesCompile = true
answer.stdout = "meep meep"
"#;
  assert!(crate::test::harness(contents).is_err());
}
