"""add suggestions_json to rank_history

Revision ID: d3f1a9b2c7e4
Revises: ac4697673c09
Create Date: 2026-06-14 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd3f1a9b2c7e4'
down_revision: Union[str, None] = 'ac4697673c09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'rank_history',
        sa.Column(
            'suggestions_json',
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'),
            nullable=False,
            server_default='[]',
        ),
    )


def downgrade() -> None:
    op.drop_column('rank_history', 'suggestions_json')
