$ErrorActionPreference = 'Stop'

git lfs pull
git rm --cached -r images
git add .gitattributes images
git status --short .gitattributes images
