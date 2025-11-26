 #!/bin/bash -ex

export SERVER_PORT=22000
export SERVER_URL=ws://127.0.0.1:$SERVER_PORT

trap 'pkill -P $$' SIGINT SIGTERM

./broker.py &
./app1.py &
sleep 2
./app2.py &

wait