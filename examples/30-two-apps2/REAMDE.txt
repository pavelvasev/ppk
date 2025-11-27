This example shows how to run separate python scripts which communicate.

Following processes are started: broker, app1 and app2.

* Broker handles communication routes.
* app1 subscribes to topic `test2` and prints when messages are received.
* after that, app1 sends messages to topic `test` every 5 seconds.
* app2 subscribes to topic `test1` and on messages in it sends some messages to topic `test2`.

Run: `./run.sh`