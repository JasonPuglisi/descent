#!/bin/bash
echo "Starting build"
echo "Starting gulp global install"
yarn global add gulp
echo "Finished gulp global install"
echo "Starting gulp build"
gulp build
echo "Finished gulp build"
echo "Finished build"
echo "Tests not implemented"
echo "Starting file clean for deployment"
rm -rf node_modules
echo "Finished file clean for deployment"
echo "Ready to deploy"
