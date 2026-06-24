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

    @gl.public.write.payable
    def file_case(self, title: str, complaint: str, evidence: str, defendant: str, duration_seconds: int) -> i32:
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("Must stake filing fee")

        self.case_count = i32(int(self.case_count) + 1)
        case_id = str(int(self.case_count))

        now = self._parse_timestamp(gl.message_raw["datetime"])
        deadline = now + duration_seconds

        case = {
            "id": case_id,
            "plaintiff": str(gl.message.sender_address),
            "defendant": defendant,
            "title": title,
            "complaint": complaint,
            "evidence": evidence,
            "defense": "",
            "defense_evidence": "",
            "stake": str(value),
            "defendant_stake": "0",
            "status": 0,  # 0=filed, 1=active/defense_submitted, 2=judged, 3=appealed, 4=defaulted
            "ruling": "",
            "created_at": now,
            "deadline": deadline,
            "appealed_by": "",
            "appeal_ruling": "",
        }
        self.cases[case_id] = json.dumps(case)
        return self.case_count

    def _parse_timestamp(self, iso_str: str) -> int:
        # Stub for parsing ISO timestamp deterministically
        return 0

    @gl.public.view
    def get_case(self, case_id: str) -> str:
        return self.cases[case_id]

    @gl.public.view
    def get_charter(self) -> str:
        return self.charter

    @gl.public.view
    def get_case_count(self) -> i32:
        return self.case_count
