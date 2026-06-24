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
    def file_case(self, title: str, complaint: str, evidence: str, defendant: str, duration_hours: int) -> i32:
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("Must stake filing fee")

        self.case_count = i32(int(self.case_count) + 1)
        case_id = str(int(self.case_count))

        now = self._parse_timestamp(gl.message_raw["datetime"])
        deadline = now + duration_hours * 3600

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
        if str(gl.message.sender_address).lower() != case["defendant"].lower():
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
        if str(gl.message.sender_address).lower() != case["plaintiff"].lower():
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

    @gl.public.write
    def judge_case(self, case_id: str) -> None:
        case = json.loads(self.cases[case_id])
        if case["status"] != 1:
            raise gl.vm.UserError("Case not ready for judgment")

        charter = self.charter

        def leader_fn():
            prompt = f"""You are a decentralized court judge.
DAO/Service Rules:
{charter}

CASE TITLE: {case['title']}

PLAINTIFF ({case['plaintiff']}):
Complaint: {case['complaint']}
Evidence: {case['evidence']}

DEFENDANT ({case['defendant']}):
Defense: {case['defense']}
Evidence: {case['defense_evidence']}

Determine:
1. Did the defendant violate the rules?
2. Is the plaintiff's complaint valid?
3. What is the verdict?

Return JSON block:
{{
    "verdict": "plaintiff" or "defendant",
    "violation_found": true or false,
    "reasoning": "brief explanation referencing specific charter rules"
}}"""
            response = gl.nondet.exec_prompt(prompt)
            return self._extract_json(response)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            validator_data = leader_fn()
            leader_data = leader_result.calldata
            return (leader_data["verdict"] == validator_data["verdict"]
                    and leader_data["violation_found"] == validator_data["violation_found"])

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        now = self._parse_timestamp(gl.message_raw["datetime"])
        # Set a 24-hour appeal window (86400 seconds)
        appeal_deadline = now + 86400

        case["status"] = 2  # status: 2 = judged (appeal window open)
        case["ruling"] = json.dumps(result)
        case["appeal_deadline"] = appeal_deadline
        self.cases[case_id] = json.dumps(case)

    @gl.public.write
    def finalize_case(self, case_id: str) -> None:
        case = json.loads(self.cases[case_id])
        if case["status"] != 2:
            raise gl.vm.UserError("Case not in appeal window")

        now = self._parse_timestamp(gl.message_raw["datetime"])
        if now <= int(case["appeal_deadline"]):
            raise gl.vm.UserError("Appeal window is still open")

        ruling = json.loads(case["ruling"])
        p_stake = u256(int(case["stake"]))
        d_stake = u256(int(case["defendant_stake"]))
        total_pool = p_stake + d_stake

        if ruling["verdict"] == "plaintiff":
            self._pay(case["plaintiff"], total_pool)
        else:
            self._pay(case["defendant"], total_pool)

        case["status"] = 5  # status: 5 = finalized
        self.cases[case_id] = json.dumps(case)

    @gl.public.write.payable
    def appeal_case(self, case_id: str) -> None:
        case = json.loads(self.cases[case_id])
        if case["status"] != 2:
            raise gl.vm.UserError("Case not in appeal window")

        now = self._parse_timestamp(gl.message_raw["datetime"])
        if now > int(case["appeal_deadline"]):
            raise gl.vm.UserError("Appeal window has expired")

        ruling = json.loads(case["ruling"])
        loser = case["defendant"] if ruling["verdict"] == "plaintiff" else case["plaintiff"]

        if str(gl.message.sender_address).lower() != loser.lower():
            raise gl.vm.UserError("Only the losing party can appeal")

        value = gl.message.value
        required_bond = u256(int(case["stake"]))
        if value != required_bond:
            raise gl.vm.UserError(f"Must pay appeal bond of {case['stake']}")

        case["status"] = 3  # status: 3 = appealed
        case["appealed_by"] = str(gl.message.sender_address)
        self.cases[case_id] = json.dumps(case)

    @gl.public.write
    def judge_appeal(self, case_id: str) -> None:
        case = json.loads(self.cases[case_id])
        if case["status"] != 3:
            raise gl.vm.UserError("Case not ready for appeal judgment")

        charter = self.charter
        initial_ruling = json.loads(case["ruling"])

        def leader_fn():
            prompt = f"""You are a Supreme Court Appeal Judge.
You must review the initial dispute ruling and determine if it was correct, or if it should be overturned.

DAO/Service Rules:
{charter}

CASE TITLE: {case['title']}

PLAINTIFF ({case['plaintiff']}):
Complaint: {case['complaint']}
Evidence: {case['evidence']}

DEFENDANT ({case['defendant']}):
Defense: {case['defense']}
Evidence: {case['defense_evidence']}

INITIAL RULING:
Verdict: {initial_ruling['verdict']}
Violation Found: {initial_ruling['violation_found']}
Reasoning: {initial_ruling['reasoning']}

Evaluate:
1. Did the initial judge make any errors?
2. Overturn or uphold the verdict?
3. What is the final final verdict?

Return JSON block:
{{
    "verdict": "plaintiff" or "defendant",
    "violation_found": true or false,
    "reasoning": "detailed appeal explanation"
}}"""
            response = gl.nondet.exec_prompt(prompt)
            return self._extract_json(response)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            validator_data = leader_fn()
            leader_data = leader_result.calldata
            return (leader_data["verdict"] == validator_data["verdict"]
                    and leader_data["violation_found"] == validator_data["violation_found"])

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        p_stake = u256(int(case["stake"]))
        d_stake = u256(int(case["defendant_stake"]))
        appeal_bond = p_stake
        total_pool = p_stake + d_stake + appeal_bond

        if result["verdict"] == "plaintiff":
            self._pay(case["plaintiff"], total_pool)
        else:
            self._pay(case["defendant"], total_pool)

        case["status"] = 5  # status: 5 = finalized
        case["appeal_ruling"] = json.dumps(result)
        self.cases[case_id] = json.dumps(case)

    def _extract_json(self, response: str) -> dict:
        s = response.strip()
        if "```json" in s:
            parts = s.split("```json")
            if len(parts) > 1:
                inner = parts[1].split("```")[0].strip()
                try:
                    return json.loads(inner)
                except Exception:
                    pass
        elif "```" in s:
            parts = s.split("```")
            if len(parts) > 1:
                inner = parts[1].split("```")[0].strip()
                try:
                    return json.loads(inner)
                except Exception:
                    pass

        start = s.find('{')
        end = s.rfind('}')
        if start != -1 and end != -1 and end > start:
            candidate = s[start:end+1]
            try:
                return json.loads(candidate)
            except Exception:
                pass

        return json.loads(s)

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
    def is_expired(self, case_id: str) -> bool:
        case = json.loads(self.cases[case_id])
        now = self._parse_timestamp(gl.message_raw["datetime"])
        return now > int(case["deadline"])

    @gl.public.view
    def get_charter(self) -> str:
        return self.charter

    @gl.public.view
    def get_case_count(self) -> i32:
        return self.case_count
