This example shows how to run separate python scripts which communicate.

Following processes are started: broker, app1 and app2.

* Broker handles communication routes.
* app1 subscribes to topic `test2` and prints when messages are received
* app2 sends some messages to topic `test2`

Even sleep for few seconds is installed between app1 and app2 start, sometimes app2 is started before app1. In that case messages are sent before app1 queries for them, and thus sent nowhere.

Run: `./run.sh`