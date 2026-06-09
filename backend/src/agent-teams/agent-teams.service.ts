import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { randomUUID } from 'crypto';
import { AgentsService } from '../agents/agents.service';
import { DatabaseService } from '../database/database.service';
import { AgentTeamMemberDto, CreateAgentTeamDto } from './dto/agent-team.dto';

export interface AgentTeam {
  id: string;
  userId: string;
  name: string;
  description: string;
  strategy: 'sequential' | 'review' | 'debate' | 'parallel' | 'consensus' | 'router';
  members: AgentTeamMemberDto[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AgentTeamRun {
  id: string;
  teamId: string;
  userId: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  error: string;
  memberOutputs: Array<{
    agentId: string;
    role: string;
    runId: string;
    status: string;
    output: string;
    error: string;
  }>;
  latencyMs: number;
  createdAt: string;
  completedAt: string | null;
}

type AgentTeamRow = {
  id: string;
  userId: string;
  name: string;
  description: string;
  strategy: AgentTeam['strategy'];
  membersJson: string;
  status: AgentTeam['status'];
  createdAt: string;
  updatedAt: string;
};

type AgentTeamGraphState = {
  memberOutputs: AgentTeamRun['memberOutputs'];
  previousOutput: string;
  output: string;
  status: AgentTeamRun['status'];
  error: string;
  index: number;
  members: AgentTeamMemberDto[];
};

@Injectable()
export class AgentTeamsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly agentsService: AgentsService,
  ) {}

  async list(userId: string): Promise<AgentTeam[]> {
    const rows = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, strategy, members_json as membersJson,
              status, created_at as createdAt, updated_at as updatedAt
       FROM agent_teams
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
    ).all(userId) as unknown as AgentTeamRow[];
    return rows.map((row) => this.mapTeam(row));
  }

  async create(userId: string, dto: CreateAgentTeamDto): Promise<AgentTeam> {
    if (!dto.members?.length) throw new BadRequestException('团队至少需要一个 Agent 成员');
    const uniqueAgentIds = new Set(dto.members.map((member) => member.agentId));
    if (uniqueAgentIds.size !== dto.members.length) throw new BadRequestException('团队成员不能重复');
    for (const member of dto.members) {
      await this.agentsService.getById(userId, member.agentId);
    }

    const id = randomUUID();
    const now = this.databaseService.now();
    const members = dto.members.map((member, index) => ({
      agentId: member.agentId,
      role: member.role?.trim() || `Agent ${index + 1}`,
      inputTemplate: member.inputTemplate?.trim() || '',
    }));
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_teams
        (id, user_id, name, description, strategy, members_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      id,
      userId,
      dto.name.trim(),
      dto.description?.trim() ?? '',
      dto.strategy ?? 'sequential',
      JSON.stringify(members),
      now,
      now,
    );
    return this.get(userId, id);
  }

  async get(userId: string, teamId: string): Promise<AgentTeam> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, user_id as userId, name, description, strategy, members_json as membersJson,
              status, created_at as createdAt, updated_at as updatedAt
       FROM agent_teams
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    ).get(teamId, userId) as unknown as AgentTeamRow | undefined;
    if (!row) throw new NotFoundException('Agent Team 不存在');
    return this.mapTeam(row);
  }

  async run(userId: string, teamId: string, input: string): Promise<AgentTeamRun> {
    const team = await this.get(userId, teamId);
    if (team.status !== 'active') throw new BadRequestException('Agent Team 已归档，无法运行');

    const runId = randomUUID();
    const startedAt = Date.now();
    const now = this.databaseService.now();
    await this.databaseService.connection.prepare(
      `INSERT INTO agent_team_runs
        (id, team_id, user_id, status, input, output, error, member_outputs_json, latency_ms, created_at)
       VALUES (?, ?, ?, 'running', ?, '', '', '[]', 0, ?)`,
    ).run(runId, team.id, userId, input, now);

    const graph = this.buildAgentTeamGraph(userId, team, input);
    const finalState = await graph.invoke({
      memberOutputs: [],
      previousOutput: '',
      output: '',
      status: 'succeeded',
      error: '',
      index: 0,
      members: [],
    } as AgentTeamGraphState) as AgentTeamGraphState;

    const completedAt = this.databaseService.now();
    const latencyMs = Date.now() - startedAt;
    await this.databaseService.connection.prepare(
      `UPDATE agent_team_runs
       SET status = ?, output = ?, error = ?, member_outputs_json = ?, latency_ms = ?, completed_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(finalState.status, finalState.output, finalState.error, JSON.stringify(finalState.memberOutputs), latencyMs, completedAt, runId, userId);
    return this.getRun(userId, runId);
  }

  private buildAgentTeamGraph(userId: string, team: AgentTeam, input: string) {
    const State = Annotation.Root({
      memberOutputs: Annotation<AgentTeamRun['memberOutputs']>(),
      previousOutput: Annotation<string>(),
      output: Annotation<string>(),
      status: Annotation<AgentTeamRun['status']>(),
      error: Annotation<string>(),
      index: Annotation<number>(),
      members: Annotation<AgentTeamMemberDto[]>(),
    });
    type StateType = typeof State.State;

    return new StateGraph(State)
      .addNode('prepare', async (state: StateType) => ({
        ...state,
        members: team.strategy === 'router' ? [this.routeMember(team, input)] : team.members,
      }))
      .addNode('parallelMembers', async (state: StateType) => {
        const memberOutputs = await Promise.all(team.members.map((member) => this.runTeamMember(userId, team, member, input, '', [])));
        const failed = memberOutputs.find((item) => item.status === 'failed');
        return {
          ...state,
          memberOutputs,
          status: failed ? 'failed' as const : 'succeeded' as const,
          error: failed ? failed.error || `${failed.role || failed.agentId} 执行失败` : '',
        };
      })
      .addNode('member', async (state: StateType) => {
        const member = state.members[state.index];
        if (!member) return state;
        const memberOutput = await this.runTeamMember(userId, team, member, input, state.previousOutput, state.memberOutputs);
        const memberOutputs = [...state.memberOutputs, memberOutput];
        const failed = memberOutput.status === 'failed';
        return {
          ...state,
          memberOutputs,
          previousOutput: failed ? state.previousOutput : memberOutput.output,
          output: failed ? state.output : memberOutput.output,
          status: failed ? 'failed' as const : state.status,
          error: failed ? memberOutput.error || `${memberOutput.role || memberOutput.agentId} 执行失败` : state.error,
          index: state.index + 1,
        };
      })
      .addNode('finalize', async (state: StateType) => {
        let output = state.output;
        if (team.strategy === 'parallel') {
          output = state.memberOutputs.map((item: AgentTeamRun['memberOutputs'][number], index: number) => `## ${index + 1}. ${item.role}\n${item.output || item.error}`).join('\n\n');
        } else if (team.strategy === 'consensus') {
          output = this.buildConsensusOutput(state.memberOutputs);
        } else if (team.strategy === 'debate' && state.memberOutputs.length > 1) {
          output = state.memberOutputs.map((item: AgentTeamRun['memberOutputs'][number], index: number) => `## ${index + 1}. ${item.role}\n${item.output}`).join('\n\n');
        }
        return { ...state, output };
      })
      .addEdge(START, 'prepare')
      .addConditionalEdges('prepare', () => (team.strategy === 'parallel' || team.strategy === 'consensus') ? 'parallelMembers' : 'member', {
        parallelMembers: 'parallelMembers',
        member: 'member',
      })
      .addEdge('parallelMembers', 'finalize')
      .addConditionalEdges('member', (state: StateType) => {
        if (state.status === 'failed') return 'finalize';
        return state.index >= state.members.length ? 'finalize' : 'member';
      }, {
        member: 'member',
        finalize: 'finalize',
      })
      .addEdge('finalize', END)
      .compile({ name: 'agent-team-graph' });
  }

  private async runTeamMember(
    userId: string,
    team: AgentTeam,
    member: AgentTeamMemberDto,
    originalInput: string,
    previousOutput: string,
    memberOutputs: AgentTeamRun['memberOutputs'],
  ): Promise<AgentTeamRun['memberOutputs'][number]> {
    const memberInput = this.buildMemberInput(team, member, originalInput, previousOutput, memberOutputs);
    const agentRun = await this.agentsService.run(userId, member.agentId, { input: memberInput });
    return {
      agentId: member.agentId,
      role: member.role ?? '',
      runId: agentRun.id,
      status: agentRun.status,
      output: agentRun.output,
      error: agentRun.error,
    };
  }

  async getRun(userId: string, runId: string): Promise<AgentTeamRun> {
    const row = await this.databaseService.connection.prepare(
      `SELECT id, team_id as teamId, user_id as userId, status, input, output, error,
              member_outputs_json as memberOutputsJson, latency_ms as latencyMs,
              created_at as createdAt, completed_at as completedAt
       FROM agent_team_runs
       WHERE id = ? AND user_id = ?`,
    ).get(runId, userId) as unknown as (Omit<AgentTeamRun, 'memberOutputs'> & { memberOutputsJson: string }) | undefined;
    if (!row) throw new NotFoundException('Agent Team 运行记录不存在');
    return {
      ...row,
      latencyMs: Number(row.latencyMs ?? 0),
      completedAt: row.completedAt || null,
      memberOutputs: this.parseMemberOutputs(row.memberOutputsJson),
    };
  }

  private buildMemberInput(
    team: AgentTeam,
    member: AgentTeamMemberDto,
    originalInput: string,
    previousOutput: string,
    memberOutputs: AgentTeamRun['memberOutputs'],
  ): string {
    const defaultTemplate = team.strategy === 'review'
      ? '你在 Multi-Agent Team 中担任 {{role}}。\n用户原始任务:\n{{originalInput}}\n\n上一位 Agent 输出:\n{{previousOutput}}\n\n请审查、补充并给出改进后的最终结果。'
      : team.strategy === 'debate'
        ? '你在 Multi-Agent Team 中担任 {{role}}。\n用户原始任务:\n{{originalInput}}\n\n其他 Agent 已有观点:\n{{allOutputs}}\n\n请给出你的独立分析、分歧点和结论。'
        : team.strategy === 'parallel' || team.strategy === 'consensus'
          ? '你在 Multi-Agent Team 中担任 {{role}}。\n用户原始任务:\n{{originalInput}}\n\n请从你的角色视角独立完成分析，输出结论、依据和风险。'
          : team.strategy === 'router'
            ? '你是被路由选中的 {{role}}。\n用户原始任务:\n{{originalInput}}\n\n请直接完成最匹配你角色能力的任务。'
            : '你在 Multi-Agent Team 中担任 {{role}}。\n用户原始任务:\n{{originalInput}}\n\n上一阶段输出:\n{{previousOutput}}\n\n请完成你负责的部分，并输出可交给下一位 Agent 的结果。';
    const template = member.inputTemplate || defaultTemplate;
    return template
      .replaceAll('{{role}}', member.role || '')
      .replaceAll('{{originalInput}}', originalInput)
      .replaceAll('{{previousOutput}}', previousOutput || '暂无')
      .replaceAll('{{allOutputs}}', memberOutputs.map((item) => `${item.role}: ${item.output}`).join('\n\n') || '暂无');
  }

  private routeMember(team: AgentTeam, input: string): AgentTeamMemberDto {
    const lower = input.toLowerCase();
    const scored = team.members.map((member) => {
      const role = `${member.role || ''} ${member.inputTemplate || ''}`.toLowerCase();
      const roleTerms = role.match(/[a-z0-9_]{3,}|[\u3400-\u9fff]{2,}/g) ?? [];
      const score = roleTerms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      return { member, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.member ?? team.members[0];
  }

  private buildConsensusOutput(memberOutputs: AgentTeamRun['memberOutputs']): string {
    const succeeded = memberOutputs.filter((item) => item.status !== 'failed');
    return [
      '## Multi-Agent Consensus',
      `参与 Agent: ${succeeded.map((item) => item.role || item.agentId).join(', ')}`,
      '## 综合结论',
      succeeded.map((item, index) => `[${index + 1}] ${item.role}: ${item.output}`).join('\n\n'),
      '## 共识说明',
      '以上结果由多个 Agent 并行生成，当前版本采用汇总式共识；可在后续版本接入裁判 Agent 做自动仲裁。',
    ].join('\n\n');
  }

  private mapTeam(row: AgentTeamRow): AgentTeam {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? '',
      strategy: row.strategy || 'sequential',
      members: this.parseMembers(row.membersJson),
      status: row.status || 'active',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private parseMembers(raw: string): AgentTeamMemberDto[] {
    try {
      const parsed = JSON.parse(raw || '[]') as unknown;
      return Array.isArray(parsed) ? parsed as AgentTeamMemberDto[] : [];
    } catch {
      return [];
    }
  }

  private parseMemberOutputs(raw: string): AgentTeamRun['memberOutputs'] {
    try {
      const parsed = JSON.parse(raw || '[]') as unknown;
      return Array.isArray(parsed) ? parsed as AgentTeamRun['memberOutputs'] : [];
    } catch {
      return [];
    }
  }
}
