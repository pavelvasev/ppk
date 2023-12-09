#!/bin/bash

export NODE_OPTIONS="--max_old_space_size=8192"
export NODE_NO_WARNINGS=1
$(dirname $0)/../services/pusha/pusha.js