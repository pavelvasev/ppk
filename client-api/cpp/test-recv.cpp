#include "ppk.h"
#include <cstdio>

int main(void) {
	printf("hi tid=%x\n",pthread_self());

	TcpSender msg_sender;
	TcpReceiver msg_receiver;
	WSConnectorToMain conn;
	ReactionsStore rstore;
	rstore.conn = &conn;
	
	// todo вот это 2 следующих лишнее вроде
	// т.е. это клиент должен по идее добавлять в rstore
	// todo вообще разобрать кто с кем связан
	rstore.msg_sender = &msg_sender; 
	conn.rstore = &rstore;
	
	/*
	ReactionsStore rstore( [&](const char *buf) {
		conn.send(buf);
	});
	*/
	Client c(&rstore);
	c.msg_sender = &msg_sender;
	c.msg_receiver = &msg_receiver;
	c.main = &conn;
	msg_receiver.client = &c;

	msg_sender.init();
	// todo это параметр программы
	msg_receiver.listen("127.0.0.1");

	printf("connecting\n");
	conn.connect("ws://127.0.0.1:10000");
	printf("connected\n");

	auto cb = [&](const char *msg) { 
		printf("------------ msg recv on topic test: %s\n",msg);
	};

	printf("sending query\n");
	c.query("test42", cb );
	c.query("test", cb );
	sleep(5000);

	conn.stop();	
	msg_sender.stop();
	msg_receiver.stop();
	
	printf("finish\n");
}