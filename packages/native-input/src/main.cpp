#include <napi.h>
#include "input.h"

static Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return bdt_input::Init(env, exports);
}

NODE_API_MODULE(native_input, InitAll)
