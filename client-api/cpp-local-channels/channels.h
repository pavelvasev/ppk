#ifndef PPK_C_H
#define PPK_C_H

// PPK channels (c) Pavel Vasev, 2024

#include <functional>
#include <vector>
#include <map>

namespace ppk {

/* делаем каналы. локальные.

   хаха. и вопрос. а что у нас в каналах передается?
   в типы уходить? охх..
*/

// канал
/*  пример

    ppk::channel<float> c1;   
    c1.subscribe( [this](float val) {
	    printf("val is %f\n",val);
    });
    c1.submit( 10.0 );    
*/
template<typename T>
class channel {

	typedef std::function<void (T)> reaction_fn;

public:	
	channel() { 	  
   }
	std::map<int,reaction_fn> subscribers;
	int next_subscriber_id = 0;

    // todo в будущем тут не воид а промиса что данные ушли
	void submit( T value ) {

		for (auto i = subscribers.begin(); i != subscribers.end(); i++) {
			i->second( value );
		}
		/*
		for (const auto & [id,f] : subscribers) {
			f( value );
		}*/
	}

	auto subscribe( reaction_fn fn) {		
		int this_subscriber_id = next_subscriber_id++;
		subscribers[this_subscriber_id] = fn;

		auto unsub = [this,this_subscriber_id]() {
			subscribers.erase( this_subscriber_id );
		};
		return unsub;

		/*
		https://stackoverflow.com/questions/20833453/comparing-stdfunctions-for-equality
		Comparison between boost::function objects cannot be implemented "well", and therefore will not be implemented. [...]

		думал по находить значению.. но нет. ну стало быть - будем по ключу..
		стало быть мэпа нужна
		

		auto unsub = [this,fn]() {
			std::vector<reaction_fn> new_subscribers;
			for (const reaction_fn &f : subscribers) {
				if (f != fn)
					new_subscribers.push_back( f );
			}
			subscribers = new_subscribers;
		};
		return unsub;
		*/
	}
};

// todo при удалении каналов - проводить отписку. ну хотя бы получателя
// связь
/*  пример

    ppk::link<float> link1;
    link1.init( input, target_channel );
*/
template<typename T>
class link {

public:	
	link( ) {}
	
	link(channel<T> &a, channel<T> &b ) {
		init(a,b);
	}

	~link() {
		stop();
	}

	void stop() {
		if (unsub) {
			unsub();
			unsub = 0;
		}
	}

	std::function<void()> unsub = 0;

	void init( channel<T> &a, channel<T> &b ) {
		if (unsub) {
			printf("link: warning! initing link that is already inited!\n");
			// todo сюда бы имена и т.п.
		};
		stop();
		auto f = [&b](T val) {
			b.submit( val );
		};
		unsub = a.subscribe( f );
	};
};

// реакция
/*  пример

    ppk::react<float> r1;
    r1.init( input, [this](float val) {
	    printf("val is %f\n",val);
    } );

    интересно что по факту я реакциями что-то вообще не пользуюсь
    т.к. есть subscribe.
    но это похоже потому что у меня нет модели времени тут, а точнее она тривиальна.
    также интересно что реакция по сигнатуре совпадает с link
    только цель не канал а функция.    
*/
template<typename T>
class react {

	typedef std::function<void (T)> reaction_fn;

public:	
	react( ) {}
	
	react(channel<T> &a, reaction_fn f ) {
		//printf("RRR\n");
		init(a,f);
	}

	~react() {
		stop();
	}

	void stop() {
		if (unsub) {
			unsub();
			unsub = 0;
		}
	}

	std::function<void()> unsub = 0;

	void init( channel<T> &a, reaction_fn f ) {
		stop();
		unsub = a.subscribe( f );
	};
};

};

#endif
