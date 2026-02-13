# SCript to initialize the agent

cd workdir && FRONTIC_CLI_DEV_MODE=1 npx -y @frontic/cli@latest login && \
FRONTIC_CLI_DEV_MODE=1 npx @frontic/cli@latest project -p aaebb809-53f9-443e-9cc1-fbde43a2f24e && \
FRONTIC_CLI_DEV_MODE=1 npx @frontic/cli@latest skills -o .claude/skills
