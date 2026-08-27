/**
 * Integration tests for taskService and timesheetService — the Project
 * Tasks and Timesheets modules. Runs against a real MongoDB, same
 * bootstrap pattern as src/smokeTest.js: a fresh throwaway company.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { nanoid } = require('nanoid');

const Project = require('../models/Project');
const Employee = require('../models/Employee');

const companyProvisioningService = require('../services/companyProvisioningService');
const taskService = require('../services/taskService');
const timesheetService = require('../services/timesheetService');

let company, branch, admin, project, employee, otherProject;

beforeAll(async () => {
  await connectDB();
  const suffix = nanoid(6).toLowerCase();

  ({ company, branch, admin } = await companyProvisioningService.onboardCompany({
    name: `Tasks/Timesheets Test Co ${suffix}`, industryType: 'services',
    adminName: 'TT Admin', adminEmail: `tt-${suffix}@test.local`,
  }));

  project = await Project.create({
    companyId: company._id, name: 'Website Revamp', code: `PRJ-${suffix}`,
    budget: 5000, status: 'in_progress',
  });
  otherProject = await Project.create({
    companyId: company._id, name: 'Unrelated Project', code: `PRJ-OTHER-${suffix}`,
  });

  employee = await Employee.create({
    companyId: company._id, branchId: branch._id, name: 'Task Employee',
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('taskService', () => {
  let task;

  test('createTask requires projectId and title', async () => {
    await expect(taskService.createTask({ companyId: company._id, title: 'no project' }))
      .rejects.toThrow(/projectId is required/);
    await expect(taskService.createTask({ companyId: company._id, projectId: project._id }))
      .rejects.toThrow(/title is required/);
  });

  test('createTask rejects an invalid priority', async () => {
    await expect(
      taskService.createTask({
        companyId: company._id, projectId: project._id, title: 'Bad priority task', priority: 'urgent',
      })
    ).rejects.toThrow(/Invalid priority/);
  });

  test('createTask defaults status to todo and priority to medium', async () => {
    task = await taskService.createTask({
      companyId: company._id, projectId: project._id, title: 'Design homepage mockup',
      description: 'Initial wireframes', assigneeId: employee._id, createdBy: admin._id,
    });
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(String(task.projectId)).toBe(String(project._id));
    expect(String(task.assigneeId)).toBe(String(employee._id));
  });

  test('updateTaskStatus rejects an invalid status', async () => {
    await expect(taskService.updateTaskStatus(company._id, task._id, 'archived'))
      .rejects.toThrow(/Invalid status/);
  });

  test('updateTaskStatus moves the task through todo -> in_progress -> done', async () => {
    let updated = await taskService.updateTaskStatus(company._id, task._id, 'in_progress');
    expect(updated.status).toBe('in_progress');

    updated = await taskService.updateTaskStatus(company._id, task._id, 'done');
    expect(updated.status).toBe('done');
  });

  test('listTasks returns the task scoped to its project, with the final status', async () => {
    const tasks = await taskService.listTasks(company._id, project._id);
    expect(tasks).toHaveLength(1);
    expect(String(tasks[0]._id)).toBe(String(task._id));
    expect(tasks[0].status).toBe('done');
    expect(tasks[0].title).toBe('Design homepage mockup');
  });

  test('listTasks scoped to a different project returns none of the above', async () => {
    const tasks = await taskService.listTasks(company._id, otherProject._id);
    expect(tasks).toHaveLength(0);
  });

  test('listTasks requires a projectId', async () => {
    await expect(taskService.listTasks(company._id, undefined)).rejects.toThrow(/projectId is required/);
  });
});

describe('timesheetService', () => {
  let entry1, entry2;

  test('logTime requires employeeId, date, and positive hours', async () => {
    await expect(timesheetService.logTime({ companyId: company._id, date: new Date(), hours: 4 }))
      .rejects.toThrow(/employeeId is required/);
    await expect(timesheetService.logTime({ companyId: company._id, employeeId: employee._id, hours: 4 }))
      .rejects.toThrow(/date is required/);
    await expect(
      timesheetService.logTime({ companyId: company._id, employeeId: employee._id, date: new Date(), hours: 0 })
    ).rejects.toThrow(/hours must be greater than zero/);
  });

  test('logTime creates a draft entry with the exact hours logged', async () => {
    entry1 = await timesheetService.logTime({
      companyId: company._id, employeeId: employee._id, projectId: project._id,
      date: '2026-08-20', hours: 6.5, description: 'Wireframing', billable: true,
    });
    expect(entry1.status).toBe('draft');
    expect(entry1.hours).toBe(6.5);
    expect(entry1.billable).toBe(true);

    entry2 = await timesheetService.logTime({
      companyId: company._id, employeeId: employee._id, projectId: project._id,
      date: '2026-08-21', hours: 3, description: 'Client review call', billable: false,
    });
    expect(entry2.status).toBe('draft');
    expect(entry2.hours).toBe(3);
  });

  test('submitTimesheet moves a draft entry to submitted, and refuses to re-submit', async () => {
    const submitted = await timesheetService.submitTimesheet(company._id, entry1._id);
    expect(submitted.status).toBe('submitted');

    await expect(timesheetService.submitTimesheet(company._id, entry1._id))
      .rejects.toThrow(/Only draft entries can be submitted/);
  });

  test('updateTimesheet refuses to edit a non-draft (submitted) entry', async () => {
    await expect(timesheetService.updateTimesheet(company._id, entry1._id, { hours: 8 }))
      .rejects.toThrow(/Only draft entries can be edited/);
  });

  test('updateTimesheet edits a draft entry\'s hours', async () => {
    const updated = await timesheetService.updateTimesheet(company._id, entry2._id, { hours: 4.5 });
    expect(updated.hours).toBe(4.5);
  });

  test('approveTimesheet requires submitted status first', async () => {
    await expect(timesheetService.approveTimesheet(company._id, entry2._id, admin._id))
      .rejects.toThrow(/Only submitted entries can be approved/);

    await timesheetService.submitTimesheet(company._id, entry2._id);
    const approved = await timesheetService.approveTimesheet(company._id, entry2._id, admin._id);
    expect(approved.status).toBe('approved');
    expect(String(approved.approvedBy)).toBe(String(admin._id));
  });

  test('listTimesheets filtered by employee and project returns both entries with the correct total hours', async () => {
    const entries = await timesheetService.listTimesheets(company._id, {
      employeeId: employee._id, projectId: project._id,
    });
    expect(entries).toHaveLength(2);
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    expect(totalHours).toBe(11); // 6.5 (submitted) + 4.5 (approved, after edit from 3)

    const statuses = entries.map((e) => e.status).sort();
    expect(statuses).toEqual(['approved', 'submitted']);
  });

  test('listTimesheets filtered by status returns only the approved entry', async () => {
    const entries = await timesheetService.listTimesheets(company._id, {
      employeeId: employee._id, status: 'approved',
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].hours).toBe(4.5);
  });

  test('deleteTimesheet refuses to delete an approved entry but allows deleting a submitted one', async () => {
    await expect(timesheetService.deleteTimesheet(company._id, entry2._id))
      .rejects.toThrow(/Approved entries cannot be deleted/);

    const result = await timesheetService.deleteTimesheet(company._id, entry1._id);
    expect(result.deleted).toBe(true);

    const remaining = await timesheetService.listTimesheets(company._id, { employeeId: employee._id });
    expect(remaining).toHaveLength(1);
    expect(String(remaining[0]._id)).toBe(String(entry2._id));
  });
});
