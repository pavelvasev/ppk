#!/bin/bash

echo ===== sequential
./0-sequential.js | grep compute:

echo ===== task-graph
./1-task-graph.js 2>/dev/null | grep compute:

echo ===== manual
./2-manual.js 2>/dev/null| grep compute:

echo ===== iter-graph
./3-iter-graph.js 2>/dev/null | grep compute: