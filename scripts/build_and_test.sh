#!/bin/bash
echo -e "\e[33mStarting build\e[39m"
echo -e "\e[33mStarting gulp global install\e[39m"
yarn global add gulp
echo -e "\e[32mFinished gulp global install\e[39m"
echo -e "\e[33mStarting gulp build\e[39m"
gulp build
echo -e "\e[32mFinished gulp build\e[39m"
echo -e "\e[32mFinished build\e[39m"
echo -e "\e[34mTests not implemented\e[39m"
echo -e "\e[34mReady to deploy\e[39m"
