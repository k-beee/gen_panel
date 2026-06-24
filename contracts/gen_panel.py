# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from datetime import datetime, timezone


class GenPanel(gl.Contract):
    case_count: i32
    cases: TreeMap[str, str]
    charter: str

    def __init__(self, charter: str):
        self.case_count = i32(0)
        self.charter = charter

    @gl.public.view
    def get_charter(self) -> str:
        return self.charter

    @gl.public.view
    def get_case_count(self) -> i32:
        return self.case_count
