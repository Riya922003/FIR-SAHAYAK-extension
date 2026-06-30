"""Add enrichment status, description_enriched, and ai_conversations table

Revision ID: 002
Revises: 001
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # New columns on firs
    op.add_column('firs', sa.Column(
        'enrichment_status',
        sa.String(),
        nullable=False,
        server_default='pending',
    ))
    op.add_column('firs', sa.Column('description_enriched', sa.Text(), nullable=True))

    # New ai_conversations table
    op.create_table(
        'ai_conversations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('fir_id', sa.String(), sa.ForeignKey('firs.id'), nullable=False, unique=True),
        sa.Column('messages', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('turn_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_ai_conversations_fir_id', 'ai_conversations', ['fir_id'])


def downgrade():
    op.drop_index('ix_ai_conversations_fir_id', 'ai_conversations')
    op.drop_table('ai_conversations')
    op.drop_column('firs', 'description_enriched')
    op.drop_column('firs', 'enrichment_status')
