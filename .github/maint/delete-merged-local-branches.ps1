$protectedBranches = @("master", "jk-main")
$targetBase = "refs/heads/jk-main"

$mergedBranches = git for-each-ref --format="%(refname:short)" --merged=$targetBase refs/heads |
  Where-Object { $_ -and ($_ -notin $protectedBranches) }

foreach ($branch in $mergedBranches) {
  git branch -d $branch
}
