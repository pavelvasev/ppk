#include <cstdio>

#include "channels.h"

class alfa 
{
public:
	channel<int> input;
	channel<int> output;

	alfa( int coef ) {
		/* типа input навсегда засабскрайбился..
		   если бы оно хотя бы выдавало не функцию отписки,
		   а объект некий.. хм
		   но с другой стороны это наш локальный инпут, что хотим то и делаем
		   */

		input.subscribe( [this,coef](int val) {
			output.submit( val * coef );
		});		
	}
};

class beta
{
public:
	channel<int> input;
	channel<int> output;

	react<int> r1; // типа красиво.. и мб технично

	beta( int coef ) {
		r1.init( input,[this,coef](int val) {
			output.submit( val * coef );
		} );
	}
};

int main(void) {
	//printf("hi tid=%x\n",pthread_self());

	channel<int> a;
	channel<int> b;

	a.subscribe( [](int val) {
		printf("a see a val %d\n",val);
	});

	a.submit(42);

	// ######################
	printf("############## II\n");

	b.subscribe( [](int val) {
		printf("b see a val %d\n",val);
	});

	link<int> link1(a,b);

	a.submit(43);
	a.submit(44);

	//////////////////////
	printf("############## III\n");
	alfa obj1(10);
	link<int> link2(a,obj1.input);
	link<int> link3(obj1.output,b);
	link1.stop();

	a.submit(55);

	////////////////////////////
	printf("############## IV\n");
	{
		a.submit(56);
		react<int> r1( b, [](int val) {
			printf("react r1 see val %d\n",val);
		});
		a.submit(57);
    }
    a.submit(58);

	printf("finish\n");
}