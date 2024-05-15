#include "ppk.h"
#include <cstdio>

int main(void) {
	printf("hi tid=%x\n",pthread_self());

	PPKConnect ppk;
	Client &c = ppk.client;

	printf("connecting\n");
	ppk.init();
	ppk.connect("ws://127.0.0.1:10000","127.0.0.1");
	printf("connected\n");

	auto cb = [&](const char *msg, int len) { 
		printf("msg recv: %.*s\n",len,msg);
	};

	printf("sending query\n");
	c.query("test2", cb );
	
	printf("sending msg, tid=%x\n",pthread_self());
	for (int i=0; i<10; i++)
		c.msg("test",(std::string("{\"a\":") + std::to_string(i) + "}").c_str());	

	c.msg("test42","{\"b\":42}");	

	printf("-------------- enter sleep\n");
	sleep(5);
	printf("-------------- sleep done\n");
	ppk.stop();
	
	printf("finish\n");
}