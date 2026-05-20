#include "input.h"
#include <vector>
#include <optional>
#include <mutex>

namespace bdt_input {

// Foreground-filter state. Default matches v2 behavior ("Minecraft" substring).
// nullopt means filter is disabled (every sendInput passes through).
static std::optional<std::string> g_foregroundFilter = std::string("Minecraft");
static std::mutex g_filterMutex;

std::string getForegroundWindowTitle() {
    HWND fg = GetForegroundWindow();
    if (fg == nullptr) {
        return std::string();
    }
    char title[256];
    int len = GetWindowTextA(fg, title, sizeof(title));
    if (len <= 0) {
        return std::string();
    }
    return std::string(title, len);
}

void setForegroundFilter(const std::string *filter) {
    std::lock_guard<std::mutex> lock(g_filterMutex);
    if (filter == nullptr) {
        g_foregroundFilter.reset();
    } else {
        g_foregroundFilter = *filter;
    }
}

int sendInput(INPUT *inputs, int inputCount) {
    {
        std::lock_guard<std::mutex> lock(g_filterMutex);
        if (g_foregroundFilter.has_value() && !g_foregroundFilter->empty()) {
            std::string title = getForegroundWindowTitle();
            if (title.find(*g_foregroundFilter) == std::string::npos) {
                return 0;
            }
        }
    }
    return static_cast<int>(SendInput(inputCount, inputs, sizeof(INPUT)));
}

Napi::Number SendInputWrapped(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "sendInput(inputs: Array, count: Number) expected")
            .ThrowAsJavaScriptException();
        return Napi::Number::New(env, 0);
    }

    Napi::Array inputArray = info[0].As<Napi::Array>();
    int inputCount = info[1].As<Napi::Number>().Int32Value();

    std::vector<INPUT> inputs;
    inputs.reserve(inputArray.Length());

    for (uint32_t i = 0; i < inputArray.Length(); i++) {
        Napi::Object obj = inputArray.Get(i).As<Napi::Object>();
        INPUT input = {};
        input.type = obj.Get("type").As<Napi::Number>().Uint32Value();

        if (input.type == INPUT_MOUSE) {
            input.mi.dx          = obj.Get("dx").As<Napi::Number>().Int32Value();
            input.mi.dy          = obj.Get("dy").As<Napi::Number>().Int32Value();
            input.mi.mouseData   = obj.Get("mouseData").As<Napi::Number>().Uint32Value();
            input.mi.dwFlags     = obj.Get("dwFlags").As<Napi::Number>().Uint32Value();
            input.mi.time        = obj.Get("time").As<Napi::Number>().Uint32Value();
            input.mi.dwExtraInfo = static_cast<ULONG_PTR>(
                obj.Get("dwExtraInfo").As<Napi::Number>().Int64Value());
        } else if (input.type == INPUT_KEYBOARD) {
            input.ki.wVk         = obj.Get("wVk").As<Napi::Number>().Uint32Value();
            input.ki.wScan       = obj.Get("wScan").As<Napi::Number>().Uint32Value();
            input.ki.dwFlags     = obj.Get("dwFlags").As<Napi::Number>().Uint32Value();
            input.ki.time        = obj.Get("time").As<Napi::Number>().Uint32Value();
            input.ki.dwExtraInfo = static_cast<ULONG_PTR>(
                obj.Get("dwExtraInfo").As<Napi::Number>().Int64Value());
        } else if (input.type == INPUT_HARDWARE) {
            input.hi.uMsg    = obj.Get("uMsg").As<Napi::Number>().Uint32Value();
            input.hi.wParamL = static_cast<WORD>(obj.Get("wParamL").As<Napi::Number>().Uint32Value());
            input.hi.wParamH = static_cast<WORD>(obj.Get("wParamH").As<Napi::Number>().Uint32Value());
        }
        inputs.push_back(input);
    }

    int result = sendInput(inputs.data(), inputCount);
    return Napi::Number::New(env, result);
}

Napi::String GetForegroundWindowTitleWrapped(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    return Napi::String::New(env, getForegroundWindowTitle());
}

void SetForegroundFilterWrapped(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "setForegroundFilter(substring: string | null) expected")
            .ThrowAsJavaScriptException();
        return;
    }
    if (info[0].IsNull() || info[0].IsUndefined()) {
        setForegroundFilter(nullptr);
    } else if (info[0].IsString()) {
        std::string s = info[0].As<Napi::String>().Utf8Value();
        setForegroundFilter(&s);
    } else {
        Napi::TypeError::New(env, "setForegroundFilter argument must be string or null")
            .ThrowAsJavaScriptException();
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("sendInput",                  Napi::Function::New(env, SendInputWrapped));
    exports.Set("getForegroundWindowTitle",   Napi::Function::New(env, GetForegroundWindowTitleWrapped));
    exports.Set("setForegroundFilter",        Napi::Function::New(env, SetForegroundFilterWrapped));
    return exports;
}

} // namespace bdt_input
