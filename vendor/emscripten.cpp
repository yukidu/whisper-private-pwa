// Local browser adapter for unmodified ggml-org/whisper.cpp v1.9.5.
// Adapted from the official examples/whisper.wasm/emscripten.cpp; MIT.
#include "whisper.h"
#include <emscripten.h>
#include <emscripten/bind.h>
#include <atomic>
#include <algorithm>
#include <string>
#include <thread>
#include <vector>

namespace {
std::thread worker;
std::vector<whisper_context *> contexts(1, nullptr);
std::atomic<int> task_state{0}; // idle=0, running=1, finished=2, failed=-1, cancelled=-2
std::atomic<bool> should_cancel{false};
bool on_abort(void * pointer) {
  return static_cast<std::atomic<bool> *>(pointer)->load(std::memory_order_acquire);
}
void join_worker() { if (worker.joinable()) worker.join(); }
}

EMSCRIPTEN_BINDINGS(starry_whisper) {
  emscripten::function("init", emscripten::optional_override([](const std::string &path) -> int {
    join_worker();
    if (contexts[0]) { whisper_free(contexts[0]); contexts[0] = nullptr; }
    contexts[0] = whisper_init_from_file_with_params(path.c_str(), whisper_context_default_params());
    task_state.store(0);
    return contexts[0] ? 1 : 0;
  }));
  emscripten::function("free", emscripten::optional_override([](int index) {
    should_cancel.store(true);
    join_worker();
    if (index == 1 && contexts[0]) { whisper_free(contexts[0]); contexts[0] = nullptr; }
    task_state.store(0);
  }));
  emscripten::function("poll_state", emscripten::optional_override([]() -> int {
    return task_state.load(std::memory_order_acquire);
  }));
  emscripten::function("cancel_transcription", emscripten::optional_override([]() {
    should_cancel.store(true, std::memory_order_release);
  }));
  emscripten::function("get_segments", emscripten::optional_override([]() -> emscripten::val {
    auto array = emscripten::val::array();
    if (task_state.load(std::memory_order_acquire) != 2 || !contexts[0]) return array;
    const int n = whisper_full_n_segments(contexts[0]);
    for (int i = 0; i < n; i++) {
      auto seg = emscripten::val::object();
      seg.set("start", double(whisper_full_get_segment_t0(contexts[0], i)) * 0.01);
      seg.set("end", double(whisper_full_get_segment_t1(contexts[0], i)) * 0.01);
      seg.set("text", std::string(whisper_full_get_segment_text(contexts[0], i)));
      array.call<void>("push", seg);
    }
    return array;
  }));
  emscripten::function("full_default", emscripten::optional_override([](
      int index, const emscripten::val &audio, const std::string &language, int requested_threads, bool translate
  ) -> int {
    if (index != 1 || !contexts[0]) return -1;
    if (task_state.load(std::memory_order_acquire) == 1) return -2;
    join_worker();
    const int n = audio["length"].as<int>();
    if (n <= 0 || n > 30 * WHISPER_SAMPLE_RATE) return -3;
    std::vector<float> samples(static_cast<size_t>(n));
    auto heap = emscripten::val::module_property("HEAPU8");
    auto memory = heap["buffer"];
    auto view = audio["constructor"].new_(memory, reinterpret_cast<uintptr_t>(samples.data()), n);
    view.call<void>("set", audio);
    should_cancel.store(false, std::memory_order_release);
    task_state.store(1, std::memory_order_release);
    worker = std::thread([samples = std::move(samples), language, requested_threads, translate]() {
      whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
      params.language = whisper_is_multilingual(contexts[0]) ? language.c_str() : "en";
      params.n_threads = std::max(1, std::min(requested_threads, 4));
      params.translate = translate;
      params.print_realtime = false;
      params.print_progress = false;
      params.print_timestamps = false;
      params.print_special = false;
      params.abort_callback = on_abort;
      params.abort_callback_user_data = &should_cancel;
      const int result = whisper_full(contexts[0], params, samples.data(), int(samples.size()));
      const int next = should_cancel.load() ? -2 : result == 0 ? 2 : -1;
      task_state.store(next, std::memory_order_release);
    });
    return 0;
  }));
}
