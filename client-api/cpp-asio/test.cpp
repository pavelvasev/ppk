#include <asio.hpp>
#include <iostream>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <thread>
#include <functional>   // Для std::function
#include <unordered_map>

using asio::ip::tcp;

class TCPClient {
private:
    asio::io_context io_context_;
    std::thread io_thread_;
    std::mutex socket_map_mutex_;
    std::unordered_map<std::string, std::unique_ptr<tcp::socket>> socket_map_;
    std::unordered_map<std::string, std::queue<std::pair<std::string, std::function<void()>>>> message_queues_;
    std::mutex queue_mutex_;

    tcp::socket& getSocket(const std::string& ip, int port) {
        std::lock_guard<std::mutex> lock(socket_map_mutex_);
        std::string key = ip + ":" + std::to_string(port);
        auto it = socket_map_.find(key);
        if (it == socket_map_.end()) {
            auto result = socket_map_.emplace(
                std::piecewise_construct, 
                std::forward_as_tuple(key), 
                std::forward_as_tuple(std::make_unique<tcp::socket>(io_context_))
            );
            it = result.first;
            tcp::resolver resolver(io_context_);
            asio::connect(*(it->second), resolver.resolve(ip, std::to_string(port)));
        }
        return *(it->second);
    }

public:
    TCPClient() {
        io_thread_ = std::thread([this] { io_context_.run(); });
    }

    ~TCPClient() {
        io_context_.stop();
        if (io_thread_.joinable())
            io_thread_.join();
    }

    void send(const std::string& ip, int port, const std::string& message, std::function<void()> callback = nullptr) {
        tcp::socket& socket = getSocket(ip, port);
        std::lock_guard<std::mutex> lock(queue_mutex_);
        std::string key = ip + ":" + std::to_string(port);
        message_queues_[key].push({message, callback});

        if (message_queues_[key].size() == 1) {
            sendMessage(socket, key);
        }
    }

private:
    void sendMessage(tcp::socket& socket, const std::string& key) {
        if (message_queues_[key].empty()) {
            return;
        }
        auto& msg = message_queues_[key].front();
        asio::async_write(socket, asio::buffer(msg.first), [this, &socket, key,&msg](std::error_code ec, std::size_t /*length*/) {
            if (!ec) {
                std::lock_guard<std::mutex> lock(queue_mutex_);
                if (msg.second) {
                    msg.second();  // Вызываем callback
                }
                message_queues_[key].pop();
                if (!message_queues_[key].empty()) {
                    sendMessage(socket, key);  // Отправляем следующее сообщение
                }
            } else {
                std::cerr << "Error on send: " << ec.message() << std::endl;
                // Обработка ошибки
            }
        });
    }
};

// Пример использования класса
int main() {
    TCPClient client;

    // Отправляем сообщение и передаем lambda-функцию в качестве callback 
    client.send("127.0.0.1", 1234, "Hello, world!", []() {
        std::cout << "Message was sent successfully!" << std::endl;
    });

    // Предотвращаем немедленное завершение main
    std::this_thread::sleep_for(std::chrono::seconds(2));

    return 0;
}