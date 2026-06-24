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

    @gl.public.write.payable
    def submit_defense(self, case_id: str, defense: str, evidence: str) -> None:
        case = json.loads(self.cases[case_id])
        if case["status"] != 0:
            raise gl.vm.UserError("Case not awaiting defense")
        if str(gl.message.sender_address) != case["defendant"]:
            raise gl.vm.UserError("Only defendant can respond")

        now = self._parse_timestamp(gl.message_raw["datetime"])
        if now > int(case["deadline"]):
            raise gl.vm.UserError("Submission deadline passed")

        value = gl.message.value
        required_stake = u256(int(case["stake"]))
        if value != required_stake:
            raise gl.vm.UserError(f"Must stake matching fee of {case['stake']}")

        case["defense"] = defense
        case["defense_evidence"] = evidence
        case["defendant_stake"] = str(value)
        case["status"] = 1  # status: 1 = active/defense_submitted
        self.cases[case_id] = json.dumps(case)

    @gl.public.write
    def claim_default_judgment(self, case_id: str) -> None:
        case = json.loads(self.cases[case_id])
        if case["status"] != 0:
            raise gl.vm.UserError("Case not eligible for default judgment")
        if str(gl.message.sender_address) != case["plaintiff"]:
            raise gl.vm.UserError("Only plaintiff can claim default judgment")

        now = self._parse_timestamp(gl.message_raw["datetime"])
        if now <= int(case["deadline"]):
            raise gl.vm.UserError("Deadline has not yet passed")

        # Mark as defaulted
        case["status"] = 4  # 4 = defaulted
        self.cases[case_id] = json.dumps(case)

        # Refund stake
        stake = u256(int(case["stake"]))
        self._pay(case["plaintiff"], stake)

    def _pay(self, recipient: str, amount: u256) -> None:
        @gl.evm.contract_interface
        class _Recipient:
            class View:
                pass
            class Write:
                pass
        _Recipient(Address(recipient)).emit_transfer(value=amount)

    def _parse_timestamp(self, iso_str: str) -> int:
        normalized = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return int(dt.timestamp())

    @gl.public.view
    def get_case(self, case_id: str) -> str:
        return self.cases[case_id]

    @gl.public.view
    def get_charter(self) -> str:
        return self.charter

    @gl.public.view
    def get_case_count(self) -> i32:
        return self.case_count
