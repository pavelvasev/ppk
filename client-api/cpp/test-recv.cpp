#include "ppk.h"
#include <cstdio>

int main(void) {
	PPKConnect ppk;
	Client &c = ppk.client;

	printf("connecting\n");
	ppk.init();
	ppk.connect("ws://127.0.0.1:10000","127.0.0.1");
	printf("connected\n");

	auto cb = [&](const char *msg, int len) { 
		printf("------------ msg recv on topic test: %.*s\n",len,msg);
	};
	auto cb2 = [&](const char *msg, int len) { 
		printf("------------ msg recv on topic test42: %.*s\n",len,msg);
	};	

	printf("sending query\n");
	c.query("test42", cb2 );
	c.query("test", cb );
	c.link( "test42","test");
	sleep(5000);

	ppk.stop();
	
	printf("finish\n");
}