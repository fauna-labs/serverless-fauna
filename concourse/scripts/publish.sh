#!/bin/sh

set -eou pipefail

cd ./repo

PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
NPM_LATEST_VERSION=$(npm view @fauna-labs/serverless-fauna version)
echo "Current package version: $PACKAGE_VERSION"
echo "Latest version in npm: $NPM_LATEST_VERSION"
if [ "$PACKAGE_VERSION" \> "$NPM_LATEST_VERSION" ]
then
  npm install

  echo "Publishing a new version..."
  echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
  npm publish
  rm .npmrc

  echo "@fauna-labs/serverless-fauna@$PACKAGE_VERSION published to npm" > ../slack-message/publish
else
  echo "@fauna-labs/serverless-fauna@${NPM_LATEST_VERSION} package has been already published" > ../slack-message/publish
  echo "@fauna-labs/serverless-fauna@${NPM_LATEST_VERSION} package has been already published" 1>&2
  exit 1
fi
