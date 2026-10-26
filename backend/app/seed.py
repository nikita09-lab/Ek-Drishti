from datetime import datetime, timedelta, date
from sqlalchemy import select, func
from app.database import Base, engine, SessionLocal
from app import models
from app.ids import new_id

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if (db.scalar(select(func.count()).select_from(models.Institution)) or 0) > 0:
            print("Database already contains institutions; no sample data added.")
            return
        inst1 = models.Institution(id="INST-DEMO-1001", name="Demo Technical Institute", institution_type="Engineering College", address="Fictional sample address", state="Maharashtra", region="West", status="Active")
        inst2 = models.Institution(id="INST-DEMO-1002", name="Sample Polytechnic College", institution_type="Polytechnic", address="Fictional sample address", state="Karnataka", region="South", status="Active")
        off1 = models.Officer(id="OFF-DEMO-01", name="Demo Officer One", designation="Assistant Director", bureau="RB", email="officer1@example.invalid")
        off2 = models.Officer(id="OFF-DEMO-02", name="Demo Officer Two", designation="Grievance Officer", bureau="PGRC", email="officer2@example.invalid")
        db.add_all([inst1, inst2, off1, off2]); db.flush()
        c1 = models.Complaint(id="COMP-DEMO-2001", institution_id=inst1.id, subject="Approval status clarification", description="Request for clarification about approval status for the current academic year.", category="Approval", assigned_bureau="RB", assigned_officer_id=off1.id, status="Under Review", source="Portal", expected_disposal_date=date.today()+timedelta(days=7))
        c2 = models.Complaint(id="COMP-DEMO-2002", institution_id=inst1.id, subject="Approval status clarification", description="Request for clarification about approval status for the current academic year.", category="Approval", assigned_bureau="PGRC", assigned_officer_id=off2.id, status="Received", source="Email", expected_disposal_date=date.today()+timedelta(days=5))
        db.add_all([c1, c2]); db.flush()
        case1 = models.Case(id="CASE-DEMO-3001", institution_id=inst1.id, title="Approval clarification review", bureau="RB", officer_id=off1.id, status="Under Process", priority="High", expected_disposal_date=date.today()+timedelta(days=7), next_action="Review supporting documents")
        case1.complaints = [c1, c2]
        case2 = models.Case(id="CASE-DEMO-3002", institution_id=inst2.id, title="Institution grievance follow-up", bureau="PGRC", officer_id=off2.id, status="Open", priority="Normal", expected_disposal_date=date.today()-timedelta(days=1), next_action="Request status update")
        db.add_all([case1, case2]); db.flush()
        db.add_all([
            models.CaseAction(id="ACT-DEMO-01", case_id=case1.id, action_type="Case created", new_status=case1.status, remarks="Fictional demo timeline event", officer_name=off1.name),
            models.CaseAction(id="ACT-DEMO-02", case_id=case2.id, action_type="Case created", new_status=case2.status, remarks="Fictional demo timeline event", officer_name=off2.name),
            models.Notification(id="NOT-DEMO-01", title="Deadline approaching", message="A sample case has a deadline approaching.", related_case_id=case1.id, read=False),
        ])
        db.commit()
        print("Added fictional AICTE OneView sample data.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
