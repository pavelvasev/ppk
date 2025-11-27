In this example, one python script starts others and they communicate.

app.py:
* creates PPK server
* starts few subprocesses defined in `worker.py`
* subscribes to topic `test2` and prints when messages are received.
* sends messages to topic `test1` every 5 seconds.

worker.py:
* connects to specified PPK server
* subscribes to topic `test1` and on messages in it sends some messages to topic `test2`.

Run: `python3 app.y`