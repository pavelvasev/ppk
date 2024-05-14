
#include <functional>
#include "mongoose.h"

#include <string>
#include <map>
#include <vector>
#include <future>
#include <mutex>

class Client;
class WSConnectorToMain;

class ConnectorToMain {
public:	
   virtual void begin_listen_list( const char *topic ) = 0;
   virtual void end_listen_list( const char *topic ) = 0;
   virtual void add_item( const char *topic, const char *name, const char *value ) = 0;
   virtual void delete_item( const char *topic, const char *name ) = 0;
};


/*
struct Reaction {
	int type; // 0 = tcp, 1 = redirect
	std::string arg1; // tcp => url, redirect => new_topic
	std::string arg2; // tcp => query_id
};
*/

typedef std::function<void (const char*)> Reaction;

typedef std::map<std::string, Reaction> ReactionsList;

////////////////////////////////////////////////// tcp

class ClientP {
public:		
	virtual void packet_received( int query_id, const char *buf ) = 0;
};



class TcpReceiver {
public:

	ClientP *client; 

	TcpReceiver() {

	}

	~TcpReceiver() {
		stop();
	}

	///////////////////////////

	struct mg_mgr mgr;        // Event manager  
  	struct mg_connection *srv_c;  // srv connection
  	bool done = false;        // Event handler flips it to true

  	//ReactionsStore *rstore;

  	std::thread mgr_thread;
  	//std::string url;

  	std::promise<void> connected;

  	std::string publish_url;
  	std::string publish_host; // тоже надо оказалось
  	int publish_port;

	void listen( const char *arg_ip ) {
		
		//url = arg_url;
		mg_mgr_init(&mgr);        // Initialise event manager
		mg_log_set(MG_LL_DEBUG);  // Set log level
		//mg_wakeup_init(&mgr);
		//printf("CO url=%s\n",url.c_str());
		char buf[512];
		snprintf( buf,sizeof(buf),"tcp://%s:0",arg_ip);
		srv_c = mg_listen( &mgr, buf, server_event_static, this );

		if (!srv_c) {
			printf("TcpReceiver:listen failed\n");
			return;
		}

		int port = (srv_c->loc.port >> 8) | ((srv_c->loc.port << 8) & 0xff00);
		snprintf( buf,sizeof(buf),"tcp://%s:%d",arg_ip,port);
		publish_url = std::string(buf);
		publish_host = std::string(arg_ip);
		publish_port = port;

		//mg_snprintf(buf, sizeof(buf), "%M", mg_print_ip_port, &srv_c->loc);         // 97.98.99.100:1234
		printf("CO L2 %s\n",publish_url.c_str());

		mgr_thread = std::thread([this]() {
			//printf("CO thread started\n");
            while (!done) {
                mg_mgr_poll(&mgr, 100); // Бесконечный цикл обработки событий
            }
            mg_mgr_free(&mgr);
        });
	}

	void stop() {
		if (done) return;
		
		done = true;
		if (mgr_thread.joinable())
			mgr_thread.join();
	}

	static void server_event_static(struct mg_connection *c, int ev, void *ev_data) {
		TcpReceiver *obj = (TcpReceiver *)c->fn_data;

		if (ev == MG_EV_CONNECT) {
			//printf("TcpRecv: connected! to c=%p\n",c);
		}
		else if (ev == MG_EV_READ) {
			//printf("TcpRecv: MG_EV_READ! len=%d\n",c->recv.len);
			unsigned char *data = c->recv.buf;
			int query_id = htonl( *(int*)data );
			int data_len = htonl( *( ((int*)data) + 1) );
			unsigned char * msg_data = data + 8;

			/* 3 случая
			   1) в буфере еще не все
			   2) в буфере слишком много
			   3) данных ровно сколько надо
			*/

			int summary_msg_len = data_len + 4 + 4;

			// 1 случай
			if (c->recv.len < summary_msg_len) {
				// данных мало - подождем
				//printf("TcpRecv:case 1 data too small, waiting next\n");
				return;
			}

			
			// там нет завершающего 0
			// поэтому приходится реаллоцировать чтобы добавился этот 0
			// ну либо - посылать указатель и длинну данных. todo подумать
			std::string reallocated( (const char*)msg_data, data_len );
			//printf(">>> QID=%d\n data_len=%d summary_msg_len=%d data in buf=%d\n",query_id,data_len,summary_msg_len,c->recv.len);
			// и получается указатель живет только пока отрабатывает каллбека.
			obj->client->packet_received( query_id, (const char*) reallocated.c_str() );
    		//mg_send(c, c->recv.buf, c->recv.len);   // Implement echo server

			// 2 случай - данных много
			if (c->recv.len > summary_msg_len) {
				//printf("TcpRecv:case 2 data too big, cutting\n");
				mg_iobuf_del(&c->recv,0,summary_msg_len);
				// уходим в рекурсию
				// todo это все очень неоптимальное - переносы буфера
				return server_event_static( c,ev,ev_data);
			}

			//printf("TcpRecv:case 3 all ok\n");

    		c->recv.len = 0;                        // Delete received data    		
		}
	}
};

/*
struct TcpSenderPacket {
	std::string target_url; // todo копирование происходит
	std::string target_query;
	const char *buf;
}

class TcpSender0 {
public:	
	struct mg_mgr mgr;        // Event manager  
	std::map<std::string,struct mg_connection*> client_connections;
	std::thread mgr_thread;
	bool done = false;

	void init() {
		mg_mgr_init(&mgr);        // Initialise event manager
		mg_log_set(MG_LL_DEBUG);  // Set log level

		mgr_thread = std::thread([this]() {
			printf("TcpSender: MGR thread STARTED %d\n",pthread_self());
            while (!done) {
                mg_mgr_poll(&mgr, 10); // Бесконечный цикл обработки событий
            }
            mg_mgr_free(&mgr);
        });

	}

	void stop() {
		if (done) return;
		
		done = true;
		if (mgr_thread.joinable())
			mgr_thread.join();
	}

	bool connected_to_client;
	void submit_data_to( const std::string &target_url, const std::string &target_query, const char *buf ) {
		//printf("GONNA SEND2: data=%s to url %s, target_query=%s\n",buf, target_url.c_str(),target_query.c_str());

		TcpSenderPacket pkt;
		pkt.target_url = target_url;
		pkt.target_query = target_query;
		pkt.buf = buf;

		mg_wakeup(&mgr, 1, &pkt, strlen(pkt));
		
	}

	static void event_static(struct mg_connection *c, int ev, void *ev_data) {
		TcpSender *obj = (TcpSender *)c->fn_data;

		if (ev == MG_EV_CONNECT) {
			//printf("TcpSender: connected! to c=%p\n",c);
			//obj->connected_to_client = true;
		}

		// Receiver side:
		if (ev == MG_EV_WAKEUP) {
		  struct mg_str *data = (struct mg_str *) ev_data;
		  struct TcpSenderPacket *pkt = (struct TcpSenderPacket *) data->buf;
		}		
	}	
	
};
*/

#include <unordered_map>
#include <mutex>
#include <thread>
#include <functional>
#include <condition_variable>
#include <iostream>
#include <string>
#include <queue>

class TcpSender {
public:
    TcpSender() {
        mg_mgr_init(&mgr);
        running = true;
        worker_thread = std::thread([this] { run_event_loop(); });
    }

    ~TcpSender() {
        stop_event_loop();
        worker_thread.join();
        mg_mgr_free(&mgr);
        /*
        for (auto& conn : connection_map) {
            mg_mgr_free_connection(conn.second);
        }
        */
    }

    void init() {};
    void stop() {};

    // функция для отправки сообщения; теперь принимает callback
    void send(const std::string& host, int query_id, const std::string& message, std::function<void()> callback) {
        std::lock_guard<std::mutex> guard(queue_mutex);
        // todo произошло копирование
        message_queue.emplace(host, query_id, message, callback);
        //cv.notify_one();
    }

private:
    struct MessageTask {
        std::string host;
        int query_id;
        std::string message;
        std::function<void()> callback;

        MessageTask(const std::string& host, int query_id, const std::string& message, std::function<void()> callback)
            : host(host), query_id(query_id), message(message), callback(std::move(callback)) {}
    };

    std::mutex queue_mutex;
    std::condition_variable cv;
    std::queue<MessageTask> message_queue;
    mg_mgr mgr;
    bool running;
    std::thread worker_thread;
    std::unordered_map<std::string, mg_connection*> connection_map;

    // Функция потока обработчика событий
    void run_event_loop() {
        while (running) {
        	//printf("....................... enter poll..\n");
            mg_mgr_poll(&mgr, 10);  // Работаем со временем в миллисекундах!
            //printf("....................... enter lock..\n");
            {
            std::unique_lock<std::mutex> lock(queue_mutex);
            //printf("....................... enter lock 2..\n");
            //cv.wait(lock, [this] { return !message_queue.empty() || !running; });
            //printf("....................... enter lock 2 done..\n");

            while (!message_queue.empty()) {
            	//printf("w1\n");
                auto task = message_queue.front();
                message_queue.pop();
                // Отправляем сообщение и вызываем callback после отправки
                mg_connection* conn = find_or_create_connection(task.host);
                //printf(">>>> to %s : %s\n",task.host.c_str(),task.message.c_str());
                int msgsize_network = htonl( task.message.size() ); // конвертация в биг ендиан
                int attachsize = 0;
                int query_id_network = htonl( task.query_id );
                printf("sending msg size=%d, task.query_id %d, content %s\n", task.message.size(),task.query_id,task.message.c_str());
                mg_send(conn, &query_id_network, 4 );
                mg_send(conn, &msgsize_network, 4 );
                if (mg_send(conn, task.message.c_str(), task.message.size()))
                {                	
                	//printf(">>>> mg_send OK\n");
                	mg_mgr_poll(&mgr, 10);
                	if (task.callback) {
                    	// todo: тут надо дождаться фактической отправки
                        task.callback();  // Вызываем callback после успешной передачи
                    }
                }
                else {

                	//printf(">>>> mg_send FAIL\n");
                	mg_mgr_poll(&mgr, 10);
                }
                /*
                if (mg_printf(conn, "%s", task.message.c_str()) > 0) {
                    //mg_mgr_poll(&mgr, 10); // Обеспечиваем передачу данных
                    if (task.callback) {
                    	// todo: тут надо дождаться фактической отправки
                        task.callback();  // Вызываем callback после успешной передачи
                    }
                }*/
            }
        	}
            //printf("w finish\n");
        }
        //printf("tcpsender loop exit\n");
    }

    // Функция инициации соединения
    mg_connection* find_or_create_connection(const std::string& host) {
        if (connection_map.find(host) == connection_map.end()) {
            // Создаем новое соединение
            connection_map[host] = mg_connect(&mgr, host.c_str(), event_handler,this);            
        }
        return connection_map[host];
    }

    // Функция остановки потока обработчика событий
    void stop_event_loop() {
        running = false;
        cv.notify_all();
    }

    static void event_handler(mg_connection* c, int ev, void* ev_data) {
        // Предоставленный обработчик событий (пример)
        if (ev == MG_EV_CONNECT) {
        	printf("@@@ MG_EV_CONNECT\n");
            // Здесь можно обрабатывать подтверждение успешной отправки
        }
        if (ev == MG_EV_WRITE) {
        	printf("@@@ MG_EV_WRITE %d\n", *(int*)ev_data);
            // Здесь можно обрабатывать подтверждение успешной отправки

        }

        
        // дополнительные события...
    }
};

//////////////////////////////////////////////////



class ReactionsStore {
	public:	

	TcpSender *msg_sender;

	std::map<std::string, ReactionsList*> rmap;
	std::mutex mutex;

	std::map<std::string, std::promise<void>> rmap_pending;
	std::mutex mutex_pending;

/*
	std::function<void (const char*)> send;

	ReactionsStore( std::function<void (const char*)> arg_send ) {
		send = arg_send;
	}
*/	
	ConnectorToMain *conn;

	ReactionsList* get_list_no_block( const char *topic ) {
		auto iter = rmap.find( topic );
		if (iter != rmap.end()) {
			return iter->second;
		}
		return 0;		
	}

	ReactionsList* get_list( const char *topic ) {

		//printf("get-list 1 %s\n",topic);
		{
			std::lock_guard<std::mutex> guard(mutex);

			auto iter = rmap.find( topic );
			if (iter != rmap.end()) {
				return iter->second;
			}
	    }

	    //printf("get-list 2\n");
		
		auto p1 = std::promise<void>();
		auto f = p1.get_future();

		// todo ну пока оно блокирующее это нормально
		/// но как ток станет неблокирующее надо вести список обещаний отдельно
		// и shared_promise/future их сделать
		{
			std::lock_guard<std::mutex> guard(mutex_pending);
			rmap_pending[ topic ] = std::move(p1);
		}
		//printf("get-list 3\n");
		conn->begin_listen_list( topic );
		
		f.wait();
		auto iter2 = rmap.find( topic );
		if (iter2 != rmap.end()) {
			return iter2->second;
		}
		printf("get_list fatal error\n");

		return 0;
	}

	// методы построения списка.. прямо здесь размещены.. хотя конечно можно и в отдельный метод вытащить
	// добавляет реакцию отправки сообщения по сети
	// в список реакций list
	void add_list_reaction_send( ReactionsList *list, std::string reaction_uid, std::string rurl, int query_id ) 
	{
		auto f = [=](const char *buf) {
			//printf("GONNA SEND: %s to url %s (%d), reaction_uid=%s conn=%p\n",buf, rurl.c_str(),rurl.size(),reaction_uid.c_str(), this->conn);
			
			//std::string msg_buf = "{\"query_id\":\"" + query_id + "\", \"m\": " + std::string(buf) + "}";

			msg_sender->send( rurl, query_id, buf, []() {
		        std::cout << "Сообщение успешно отправлено! (каллбека tcp-sender)" << std::endl;
		    });
		};
		(*list)[ reaction_uid ] = f;
	}

	void remove_list_reaction( ReactionsList *list, const char *reaction_uid ) 
	{
		list->erase( reaction_uid );
	}

	void begin_listen_list_reply( const char *topic, ReactionsList *list ) 
	{
		printf("called begin_listen_list, topic=%s, list size=%d self=%p\n",topic,list->size(),this);
		
		std::lock_guard<std::mutex> guard(mutex);
		rmap[ std::string(topic) ] = list;

		std::lock_guard<std::mutex> guard2(mutex_pending);
		rmap_pending[ topic ].set_value();

		printf("begin_listen_list finish\n");
	}

    // а эти вообще не нужны т.к. списки теперь вон там где модифицируются отдельно
	void set( mg_str crit, mg_str arg ) 
	{
		std::lock_guard<std::mutex> guard(mutex);
		std::string topic(crit.buf, crit.len);

		auto iter = rmap.find( topic );
		if (iter == rmap.end()) {
			printf("SET ERROR\n");
			return;
		}

		ReactionsList *list = rmap[ topic ];		

		// todo fill list
		
	}
	void remove( mg_str crit, mg_str arg ) 
	{
		std::lock_guard<std::mutex> guard(mutex);
		std::string topic(crit.buf, crit.len);

		auto iter = rmap.find( topic );
		if (iter == rmap.end()) {
			printf("SET ERROR\n");
			return;
		}

		ReactionsList *list = rmap[ topic ];

		// todo fill list
	}
};

/*
   client.msg( "image", screen );
   

*/

class Client : public ClientP {
public:	

	ReactionsStore *rstore = 0;
	
	ConnectorToMain *main = 0;
	TcpSender       *msg_sender = 0;
	TcpReceiver     *msg_receiver = 0;

	std::string client_id;

	Client(ReactionsStore *arg_rstore)  {
		rstore = arg_rstore;
		// todo: add host
		client_id = "cpp_client_" + std::to_string( pthread_self() );
		//, TcpSender *arg_msg_sender
		//msg_sender = arg_msg_sender;
	}

	void msg( const char *topic, const char* msg ) {		

		auto list = rstore->get_list( topic );
		/*
		rstore->get_list( topic,[&](ReactionsList* list) {
			// iterate, call
		} )
		*/

		if (list) {
			//printf("calling reactions! of list size %d\n",list->size());
			for (auto const& x : *list) {
				x.second( msg );
			}
		} else {
			//printf("msg: no list!\n");
		}
	}
	// todo: N
	// идея а что если эта штука вернет процесс в форме объекта?
	// из которого например торчит очередь или какой-то поток
	int query_id_counter = 0;
	std::map<int, std::function<void (const char*)>> query_callbacks;

	void query( const char *topic, std::function<void (const char*)> callback ) {

		//callback( topic, "one" );
		char reaction_guid_buf[1024];
		int this_query_id = query_id_counter++;

		query_callbacks[ this_query_id ] = callback;

		snprintf( reaction_guid_buf, sizeof(reaction_guid_buf),"%s_id_%d",client_id.c_str(), this_query_id );
		char reaction_buf[1024];
		snprintf( reaction_buf, sizeof(reaction_buf),"{ \"action\": {\"code\":\"do_query_send\",\"arg\":{\"query_id\":%d,\"results_url\":{\"url\":\"%s\",\"host\":\"%s\",\"port\":%d}}}}",
					this_query_id, msg_receiver->publish_url.c_str(),msg_receiver->publish_host.c_str(),msg_receiver->publish_port );

		main->add_item( topic, reaction_guid_buf, reaction_buf );
	}

	virtual void packet_received( int query_id, const char *buf ) {
		// это в другом потоке все
		// printf("message_arrived: query_id=%d\n",query_id);
		auto fn = query_callbacks[ query_id ];
		fn( buf );
	}

};

class WSConnectorToMain : public ConnectorToMain {
public:

	// вообще это база. а остальное его обеспечивает.
	// так может обеспечение вынести в отдельный класс?
	// а сюда подается только штука которая уже - чтение и запись сообщений?

	WSConnectorToMain() {

	}

	~WSConnectorToMain() {
		stop();
	}

	///////////////////////////

	struct mg_mgr mgr;        // Event manager  
  	struct mg_connection *c;  // Client connection
  	bool done = false;        // Event handler flips it to true

  	ReactionsStore *rstore;

  	std::thread thread;
  	std::string url;

  	std::promise<void> connected;

	void connect( const char *arg_url ) {
		//printf("CO1 url=%s\n",url);
		//rstore = arg_rstore;
		url = arg_url;
	    
	    thread = std::thread(&WSConnectorToMain::do_connect,this);
	    //thread.detach();
		
	    connected.get_future().wait();
	}

	void do_connect() {
		
		mg_mgr_init(&mgr);        // Initialise event manager
		mg_log_set(MG_LL_DEBUG);  // Set log level
		mg_wakeup_init(&mgr);
		//printf("CO url=%s\n",url.c_str());
		c = mg_ws_connect(&mgr, url.c_str(), ws_event_static, this, NULL);     // Create client
		//printf("")
		connected.set_value();

		//printf("WS connected, entering loop\n");
		//int i=2;
		while (c && done == false) {
		  mg_mgr_poll(&mgr, 500);  // Wait for echo
		  //if (i-- == 0) break;
		}
		//printf("WS loop finished, CO stop done=%d\n",done ? 1 : 0);
		mg_mgr_free(&mgr);                                   // Deallocate resources
		//printf("mgr deallocated\n");		
	}

	void stop() {
		if (done) return;
		done = true;
		//printf("calling join\n");
		thread.join();
		//printf("calling join done\n");
	}

	static void ws_event_static(struct mg_connection *c, int ev, void *ev_data) {
		WSConnectorToMain *obj = (WSConnectorToMain *)c->fn_data;
		obj->ws_event( c, ev, ev_data );
	}

    // https://mongoose.ws/documentation/
	void ws_event(struct mg_connection *c, int ev, void *ev_data ) {
	  if (ev == MG_EV_OPEN) {
	    //c->is_hexdumping = 1;
	  } else if (ev == MG_EV_ERROR) {
	    // On error, log error message
	    MG_ERROR(("%p %s", c->fd, (char *) ev_data));
	  } else if (ev == MG_EV_WS_OPEN) {
	    // When websocket handshake is successful, send message

	    // mg_ws_send(c, "hello", 5, WEBSOCKET_OP_TEXT);

	  } else if (ev == MG_EV_WS_MSG) {
	    // When we get echo response, print it
	    struct mg_ws_message *wm = (struct mg_ws_message *) ev_data;	    
	    printf("GOT MSG: [%.*s]\n", (int) wm->data.len, wm->data.buf);
	    on_message( wm );
	  }
	  else if (ev == MG_EV_WAKEUP) {
    	struct mg_str *data = (struct mg_str *) ev_data;
    	//printf("!!!!!!!!!!! got wakeup, sending: [%.*s]\n",data->len,data->buf);
    	mg_ws_send(c, data->buf, data->len, WEBSOCKET_OP_TEXT);
      }

	  if (ev == MG_EV_ERROR || ev == MG_EV_CLOSE) {
	  	this->done = true;
	    // Signal that we're done
	  }
	}

	void on_message( mg_ws_message *wm ) {
		 mg_str json = wm->data;
		 mg_str val = mg_json_get_tok(json, "$.opcode");

		 //printf("json opcode is: [%.*s]\n",val.len, val.buf);
		 
		 if (0 == mg_strcmp( val, mg_str("\"begin_listen_list_reply\""))) {
		 	//printf("got begin_listen_list_reply\n");
		 	//mg_str crit = mg_json_get_tok(json, "$.crit");
		 	mg_str entries = mg_json_get_tok(json, "$.entries");

		 	//printf("json entries ar: [%.*s]\n",entries.len, entries.buf);
		 	struct mg_str key, val;
			size_t ofs = 0;

			ReactionsList *rlist = new ReactionsList;

			//printf("EEE1\n");
			while ((ofs = mg_json_next(entries, ofs, &key, &val)) > 0) {
				//printf("EEE2\n");
			  //printf("KEY %.*s -> VALUE %.*s\n", (int) key.len, key.buf, (int) val.len, val.buf);

			  char *id = mg_json_get_str(val, "$[0]");
			  //printf("id is: %s\n",id );
			  char *action_code = mg_json_get_str(val, "$[1].action.code");
			  //printf("action_code is: %s\n",action_code );
			  
			  Reaction r;
			  if (strcmp(action_code,"do_query_send") == 0) {
				  int qid = mg_json_get_long(val, "$[1].action.arg.query_id",0);
				  //printf("qid is: %s\n",qid );
				  char *rurl = mg_json_get_str(val, "$[1].action.arg.results_url.url");
				  //printf("rurl is: %s\n",rurl );

				  rstore->add_list_reaction_send( rlist, id, rurl, qid);

				  free( rurl );
			  	  //free( qid );
			  }
			  else
			  if (strcmp(action_code,"forward") == 0) {
			  	char *next_label = mg_json_get_str(val, "$[1].action.arg.next_label");
				printf("next_label is: %s\n",next_label );
			  	printf("unimplemented\n");
			  	free( next_label);
			  }
			  else {
			  	printf("fatalllll\n");
			  }			  	
			  
			  free( id );
			  free( action_code );
			}
		 	char *crit = mg_json_get_str(json, "$.crit");
		 	printf("EEE3 %s %p\n",crit, rstore);
		 	//printf("json crit is: %s\n",crit );
		 	rstore->begin_listen_list_reply( crit,rlist );
		 	free( crit );
		 	return;
		 }
		 //printf("not begin_listen_list_reply\n");

		 if (0 == mg_strcmp( val, mg_str("set"))) {
		 	printf("got set\n");
		 	mg_str crit = mg_json_get_tok(json, "$.crit");
		 	mg_str arg = mg_json_get_tok(json, "$.arg");
		 	rstore->set( crit, arg );
		 	return;
		 }

		 if (0 == mg_strcmp( val, mg_str("delete"))) {
		 	printf("got delete\n");
		 	mg_str crit = mg_json_get_tok(json, "$.crit");
		 	mg_str arg = mg_json_get_tok(json, "$.arg");
		 	rstore->remove( crit, arg );
		 	return;
		 }		 

		 
		 /*
		 if (0 == mg_strcmp( val, mg_str("end_listen_list_reply"))) {
		 	printf("got end_listen_list\n");
		 	return;
		 }

		 if (0 == mg_strcmp( val, mg_str("add_item_reply"))) {
		 	printf("got add_item\n");
		 	return;
		 }

		 if (0 == mg_strcmp( val, mg_str("remove_item_reply"))) {
		 	printf("got remove_item\n");
		 	return;
		 }
		 */
	}

	void send( const char *buf ) {
		// прикол в том что оно там копирует зачем-то
		//printf("!!! sending wakup to mgr, %s\n",buf);
		mg_wakeup(&mgr, c->id, buf, strlen(buf));
		//mg_send
		//mg_ws_send(c, buf, strlen(buf), WEBSOCKET_OP_TEXT);
	}

	virtual void begin_listen_list( const char *topic ) {
		char buf[1024];
		snprintf( buf,sizeof(buf),"{ \"cmd\":\"begin_listen_list\",\"crit\":\"%s\"}",topic);
		send( buf );
	}

	virtual void end_listen_list( const char *topic ) {
		char buf[1024];
		snprintf( buf,sizeof(buf),"{ \"cmd\":\"end_listen_list\",\"crit\":\"%s\"}",topic);
		send( buf );
	}	

	virtual void add_item( const char *topic, const char *name, const char *value ) {
		char buf[1024];
		snprintf( buf,sizeof(buf),"{ \"cmd\":\"add_item\",\"crit\":\"%s\", \"name\":\"%s\",\"value\":%s }",topic,name, value);
		send( buf );
	}

	virtual void delete_item( const char *topic, const char *name ) {
		char buf[1024];
		snprintf( buf,sizeof(buf),"{ \"cmd\":\"delete_item\",\"crit\":\"%s\", \"name\":\"%s\" }",topic,name);
		send( buf );
	}	

};