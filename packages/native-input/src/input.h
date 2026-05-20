#pragma once
#include <napi.h>
#include <windows.h>
#include <string>

namespace bdt_input {

// Low-level: forwards an array of INPUT structs to SendInput().
// Gated on the foreground window title matching the current filter (default "Minecraft").
// Pass an empty filter (null in JS) to disable the gate.
int sendInput(INPUT *inputs, int inputCount);
Napi::Number SendInputWrapped(const Napi::CallbackInfo &info);

// Foreground window helpers.
std::string getForegroundWindowTitle();
Napi::String GetForegroundWindowTitleWrapped(const Napi::CallbackInfo &info);

// Configure the foreground-filter substring (case-sensitive). Pass null to disable.
void setForegroundFilter(const std::string *filter);
void SetForegroundFilterWrapped(const Napi::CallbackInfo &info);

Napi::Object Init(Napi::Env env, Napi::Object exports);

} // namespace bdt_input
