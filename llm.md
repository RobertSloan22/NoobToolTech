✔ Compiled llama.cpp


To use the binary you've just built, use this code:
----------------------------------------
import {getLlama} from "node-llama-cpp";

const llama = await getLlama({
    gpu: "cuda"
});
----------------------------------------

To always use the latest binary you build using a CLI command, use this code:
------------------------------------------
import {getLlama} from "node-llama-cpp";

const llama = await getLlama("lastBuild");
------------------------------------------


Repo: ggerganov/llama.cpp
Release: b4600

Done
robert@robertrtx:~/vehicleapi/eliza-starter$