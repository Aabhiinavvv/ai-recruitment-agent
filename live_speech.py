from pathlib import Path

import streamlit.components.v1 as components


_live_speech = components.declare_component(
    "live_speech_recognition",
    path=str(Path(__file__).with_name("live_speech_component")),
)


def live_speech_recognition(question, key):
    return _live_speech(question=question, key=key, default={})
