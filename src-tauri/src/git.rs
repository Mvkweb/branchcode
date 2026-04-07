use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub staged: Vec<GitFile>,
    pub modified: Vec<GitFile>,
    pub untracked: Vec<GitFile>,
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFile {
    pub path: String,
    pub status: String,
    pub additions: i32,
    pub deletions: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiff {
    pub path: String,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub diff: String,
    pub additions: i32,
    pub deletions: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

pub struct GitService {
    project_path: String,
}

impl GitService {
    pub fn new(project_path: String) -> Self {
        Self { project_path }
    }

    fn run_git(&self, args: &[&str]) -> Result<String, String> {
        let output = Command::new("git")
            .args(args)
            .current_dir(&self.project_path)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(stderr.to_string())
        }
    }

    pub fn is_git_repo(&self) -> bool {
        Command::new("git")
            .args(["rev-parse", "--is-inside-work-tree"])
            .current_dir(&self.project_path)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    pub fn get_status(&self) -> Result<GitStatus, String> {
        if !self.is_git_repo() {
            return Ok(GitStatus {
                branch: String::new(),
                staged: vec![],
                modified: vec![],
                untracked: vec![],
                is_repo: false,
            });
        }

        let branch = self.get_current_branch().unwrap_or_else(|_| "unknown".to_string());

        let output = self.run_git(&["status", "--porcelain", "-unormal"])?;
        let lines: Vec<&str> = output.lines().collect();

        let mut staged: Vec<GitFile> = vec![];
        let mut modified: Vec<GitFile> = vec![];
        let mut untracked: Vec<GitFile> = vec![];

        for line in lines {
            if line.len() < 3 {
                continue;
            }

            let index_status = line.chars().next().unwrap_or(' ');
            let worktree_status = line.chars().nth(1).unwrap_or(' ');
            let path = line[3..].trim().to_string();

            let status_char = if index_status != ' ' && index_status != '?' {
                index_status.to_string()
            } else if worktree_status != ' ' {
                worktree_status.to_string()
            } else {
                "?".to_string()
            };

            let file = GitFile {
                path: path.clone(),
                status: status_char,
                additions: 0,
                deletions: 0,
            };

            match (index_status, worktree_status) {
                ('?', '?') => untracked.push(file),
                ('M', ' ') | ('M', 'M') | (' ', 'M') => modified.push(file),
                ('A', _) | (' ', 'A') => staged.push(file),
                ('D', _) => staged.push(file),
                ('R', _) => staged.push(file),
                ('C', _) => staged.push(file),
                _ => {
                    if index_status != ' ' && index_status != '?' {
                        staged.push(file);
                    } else if worktree_status != ' ' && worktree_status != '?' {
                        modified.push(file);
                    }
                }
            }
        }

        Ok(GitStatus {
            branch,
            staged,
            modified,
            untracked,
            is_repo: true,
        })
    }

    pub fn get_diff(&self, file_path: &str) -> Result<GitDiff, String> {
        let output = self.run_git(&["diff", "HEAD", "--no-color", "--", file_path])?;

        let (additions, deletions) = Self::parse_diff_stats(&output);

        let new_content = self.get_file_content(file_path);
        let old_content = self.run_git(&["show", &format!("HEAD:{}", file_path)])
            .ok();

        Ok(GitDiff {
            path: file_path.to_string(),
            old_content,
            new_content,
            diff: output,
            additions,
            deletions,
        })
    }

    fn parse_diff_stats(diff: &str) -> (i32, i32) {
        let mut additions = 0;
        let mut deletions = 0;

        for line in diff.lines() {
            if line.starts_with("+") && !line.starts_with("+++") {
                additions += 1;
            } else if line.starts_with("-") && !line.starts_with("---") {
                deletions += 1;
            }
        }

        (additions, deletions)
    }

    fn get_file_content(&self, path: &str) -> Option<String> {
        std::fs::read_to_string(Path::new(&self.project_path).join(path)).ok()
    }

    pub fn get_current_branch(&self) -> Result<String, String> {
        let output = self.run_git(&["branch", "--show-current"])?;
        Ok(output.trim().to_string())
    }

    pub fn get_branches(&self) -> Result<Vec<GitBranch>, String> {
        let output = self.run_git(&["branch", "-a"])?;
        let lines: Vec<&str> = output.lines().collect();

        let current = self.get_current_branch().unwrap_or_default();
        let mut branches: Vec<GitBranch> = vec![];

        for line in lines {
            let name = line.trim().trim_start_matches("* ").trim().to_string();
            if name.is_empty() {
                continue;
            }

            let is_current = name == current;
            let is_remote = name.starts_with("remotes/") || name.starts_with("origin/");

            branches.push(GitBranch {
                name,
                is_current,
                is_remote,
            });
        }

        Ok(branches)
    }

    pub fn checkout_branch(&self, branch_name: &str) -> Result<(), String> {
        self.run_git(&["checkout", branch_name])?;
        Ok(())
    }

    pub fn create_branch(&self, branch_name: &str) -> Result<(), String> {
        self.run_git(&["checkout", "-b", branch_name])?;
        Ok(())
    }

    pub fn stage_file(&self, file_path: &str) -> Result<(), String> {
        self.run_git(&["add", file_path])?;
        Ok(())
    }

    pub fn unstage_file(&self, file_path: &str) -> Result<(), String> {
        self.run_git(&["reset", "HEAD", "--", file_path])?;
        Ok(())
    }

    pub fn stage_all(&self) -> Result<(), String> {
        self.run_git(&["add", "-A"])?;
        Ok(())
    }

    pub fn commit(&self, message: &str) -> Result<(), String> {
        self.run_git(&["commit", "-m", message])?;
        Ok(())
    }

    pub fn get_diff_stats(&self) -> Result<Vec<GitFile>, String> {
        let output = self.run_git(&["diff", "HEAD", "--stat", "--no-color"])?;
        let lines: Vec<&str> = output.lines().collect();

        let mut files: Vec<GitFile> = vec![];

        for line in lines {
            if line.contains("|") {
                let parts: Vec<&str> = line.split("|").collect();
                if parts.len() >= 2 {
                    let path = parts[0].trim().to_string();
                    let stats = parts[1].trim();

                    let mut additions = 0;
                    let mut deletions = 0;

                    if let Some(plus_count) = stats.matches('+').count().checked_sub(1) {
                        additions = plus_count as i32;
                    }
                    if let Some(minus_count) = stats.matches('-').count().checked_sub(1) {
                        deletions = minus_count as i32;
                    }

                    files.push(GitFile {
                        path,
                        status: "M".to_string(),
                        additions,
                        deletions,
                    });
                }
            }
        }

        Ok(files)
    }
}