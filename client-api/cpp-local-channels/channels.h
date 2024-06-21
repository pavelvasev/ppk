#ifndef PPK_C_H
#define PPK_C_H

#include <functional>
#include <vector>

/* делаем каналы. локальные.

   хаха. и вопрос. а что у нас в каналах передается?
   в типы уходить? охх..
*/

// канал
template<typename T>
class Channel {

	typedef std::function<void (T)> reaction_fn;

public:	
	Channel() {}
	std::vector<reaction_fn> subscribers;

    // todo в будущем тут не воид а промиса что данные ушли
	void submit( T value ) {
		for (const reaction_fn &f : subscribers) {
			f( value );
		}
	}

	auto subscribe( reaction_fn fn) {
		subscribers.push_back( fn );

		/*
		https://stackoverflow.com/questions/20833453/comparing-stdfunctions-for-equality
		Comparison between boost::function objects cannot be implemented "well", and therefore will not be implemented. [...]

		думал по находить значению.. но нет. ну стало быть - будем по ключу..
		стало быть мэпа нужна
		*/

		auto unsub = [this,fn]() {
			std::vector<reaction_fn> new_subscribers;
			for (const reaction_fn &f : subscribers) {
				if (f != fn)
					new_subscribers.push_back( f );
			}
			subscribers = new_subscribers;
		};
		return unsub;
	}
};

// связь
template<typename T>
class Link {

	typedef std::function<void (T)> reaction_fn;

public:	
	Link() {}
	~Link() {
		if (unsub) {
			unsub();
			unsub = 0;
		}
	}

	std::function<void()> unsub = 0;

	Link& init( Channel<T> a, Channel<T> b ) {
		auto f = [&b](T&val) {
			b.submit( val );
		};
		unsub = a.subscribe( f );
	}	
};

#endif