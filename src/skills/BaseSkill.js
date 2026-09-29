const AgentLog = require('../models/AgentLog');

/**
 * BaseSkill
 * Abstract contract for agentic skills with automated telemetry, performance timing,
 * and persistence in the agent_logs table.
 */
class BaseSkill {
  constructor(name, description = '') {
    if (new.target === BaseSkill) {
      throw new TypeError('Cannot construct BaseSkill abstract instances directly.');
    }
    this.name = name;
    this.description = description;
  }

  /**
   * Subclasses must implement the domain logic
   * @param {Object} context - Execution payload/state
   * @returns {Promise<Object>} Result data
   */
  async run(context) {
    throw new Error(`Skill ${this.name} must implement run(context) method.`);
  }

  /**
   * Executes the skill with lifecycle logging, exception handling, and execution time measurement
   * @param {Object} context - Input context
   * @param {number|null} saleId - Optional associated sale ID
   * @returns {Promise<Object>} Execution outcome
   */
  async execute(context, saleId = null) {
    const startTime = performance.now();

    // Create pending log
    const log = AgentLog.create({
      sale_id: saleId,
      skill_name: this.name,
      payload: { input: context },
      status: 'pending'
    });

    try {
      const output = await this.run(context, saleId);
      const executionTime = Math.round((performance.now() - startTime) * 100) / 100;

      // Update log to success
      AgentLog.update(log.id, {
        status: 'success',
        payload: { input: context, output },
        execution_time: executionTime
      });

      return {
        success: true,
        skill: this.name,
        logId: log.id,
        executionTime,
        data: output
      };
    } catch (error) {
      const executionTime = Math.round((performance.now() - startTime) * 100) / 100;

      AgentLog.update(log.id, {
        status: 'failed',
        payload: { input: context, error: error.message, stack: error.stack },
        execution_time: executionTime
      });

      return {
        success: false,
        skill: this.name,
        logId: log.id,
        executionTime,
        error: error.message
      };
    }
  }
}

module.exports = BaseSkill;
