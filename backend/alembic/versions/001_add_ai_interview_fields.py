"""add ai_interview_summary and suggested_ipc_sections to firs

Revision ID: 001
Revises:
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('firs', sa.Column('ai_interview_summary', sa.Text(), nullable=True))
    op.add_column('firs', sa.Column('suggested_ipc_sections', sa.String(), nullable=True))


def downgrade():
    op.drop_column('firs', 'suggested_ipc_sections')
    op.drop_column('firs', 'ai_interview_summary')
