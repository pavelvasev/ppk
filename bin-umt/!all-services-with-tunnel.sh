#!/bin/bash

#http://127.0.0.1:8000/tests/20-cube/coview-plugin/show-cube.cl
#ws://127.0.0.1:12000 repr-ws
ssh -t -t -L 8000:localhost:8000 -L 12000:localhost:12000 -L 3333:localhost:3333 u1321@umt.imm.uran.ru "cd /home/u1321/_scratch2/ppk/k2/; ./all-main-services.sh"