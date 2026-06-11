# Version Control Recommendation

Created: 2026-06-08

---

## Why This Is Now Urgent

The Tuti Marketplace has no Git repository. The current situation:

- No commit history means there is no rollback capability. Any accidental file deletion, bad edit, or broken refactor can only be undone by restoring from a manual backup archive.
- Manual backup archives are stored in `/private/tmp/` which macOS clears after reboots or after a period of inactivity. The current backup at `/private/tmp/tuti-backup-20260608-160219.tar.gz` is at risk of loss.
- No permanent remote copy exists. There is no `~/Tuti-Backups/` directory.
- Multiple developers or sessions working without version control have no merge or conflict resolution path.
- No CI/CD pipeline can be built without a Git remote.

Initializing Git and pushing to a private remote is now the single most important infrastructure action before any new feature work begins.

---

## What Must Be Excluded

Create `.gitignore` in the repository root before the first `git add`. It must exclude:

```gitignore
# Dependencies
node_modules/

# Build output
dist/
.vite/

# Environment files containing secrets
.env
.env.local
.env.*.local
backend/.env

# macOS metadata
.DS_Store
**/.DS_Store

# Test artefacts
test-results/

# Generated artefacts in tools/archive (optional: include script source but exclude outputs)
# tools/archive/*.png is already excluded by the assets rule above

# Local upload storage (production uses S3)
backend/uploads/
```

The `.env.example` files (root and `apps/web/`) document expected variables but contain no secrets. They should be committed.

---

## Recommended First Baseline

These are the exact commands to run. **Do not run these until you are ready to commit — confirm with a fresh build and all tests passing first.**

```bash
# 1. Navigate to the project root
cd /Users/hassanomer/Projects/Perfume-Marketplace

# 2. Verify build passes before committing
npm run build

# 3. Verify tests pass
node --test backend/src/modules/orders/*.test.js \
     backend/src/shared/workflows/*.test.js \
     backend/src/modules/finance/*.test.js

# 4. Create the .gitignore (do this before git add)
# (Write the content shown in the "What Must Be Excluded" section above)

# 5. Initialise Git
git init

# 6. Stage all tracked files (the .gitignore will exclude what should be excluded)
git add .

# 7. Verify what will be committed — review carefully before proceeding
git status

# 8. Create the initial commit
git commit -m "Initial baseline commit — Tuti Marketplace v0.2.0"

# 9. Add the private remote and push
git remote add origin <your-remote-url>
git push -u origin main
```

Verify the commit does not include `.env`, `node_modules`, or `dist` files. If any of those appear in `git status`, stop and fix `.gitignore` before proceeding.

---

## Permanent Backup (manual — before Git is set up)

The current backup at `/private/tmp/tuti-backup-20260608-160219.tar.gz` is in a temporary location and will be deleted by macOS on reboot.

Copy it to a permanent location immediately:

```bash
mkdir -p ~/Tuti-Backups
cp /private/tmp/tuti-backup-20260608-160219.tar.gz ~/Tuti-Backups/
ls -lh ~/Tuti-Backups/
```

After Git is initialized and pushed to a remote, the manual archive serves only as a point-in-time snapshot. It does not need to be updated after each session.

---

## Private Remote Options

| Option | Notes |
|---|---|
| **GitHub (private repo)** | Simplest. Free for private repos. Integrate with GitHub Actions for CI/CD. |
| **GitLab (private project)** | Built-in CI/CD pipeline. Good for teams. |
| **Azure DevOps / AWS CodeCommit** | If already using those clouds for other infrastructure. |
| **Gitea (self-hosted)** | Free, private, no external dependency. Requires a server to run on. |

All options support private repositories. Do not create a public repository for this project.

---

## After Git Is Initialized

1. Create a `main` branch protection rule (require at least one approval for direct pushes to main).
2. Create a `.github/workflows/` CI pipeline that runs `npm run build` and `node --test` on every pull request.
3. Add a branch naming convention: `feature/`, `fix/`, `chore/`.
4. Tag the initial baseline commit: `git tag v0.2.0-baseline`.
