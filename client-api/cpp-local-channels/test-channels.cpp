#include <cstdio>

#include "channels.h"


int main(void) {
	//printf("hi tid=%x\n",pthread_self());

	Channel<int> a;
	Channel<int> b;

	a.subscribe( [](int val) {
		printf("see a val %d\n",val);
	});
		
	printf("finish\n");
}