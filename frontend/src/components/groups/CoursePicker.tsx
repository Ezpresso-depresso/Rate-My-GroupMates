/*
 * Department + course pickers, so a group can only be for a real UCI course. Each is a dropdown
 * you can also type into ("swe", "software", "113", "requirements"). `value` / `onChange` carry
 * the course code, e.g. "COMPSCI 161" ('' until one is picked).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiError } from '../../services/api';
import type { Course, Department } from '../../types';
import { Combobox, type ComboOption } from '../common/Combobox';

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export function CoursePicker({ value, onChange }: Props) {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [department, setDepartment] = useState('');
  const [courses, setCourses] = useState<{ department: string; list: Course[] } | null>(null);
  const [error, setError] = useState('');
  const courseInput = useRef<HTMLInputElement>(null);
  const focusCourse = useRef(false);

  useEffect(() => {
    api
      .courseDepartments()
      .then(setDepartments)
      .catch((err: ApiError) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!department) return;
    let current = true;
    api
      .coursesIn(department)
      .then((list) => current && setCourses({ department, list }))
      .catch((err: ApiError) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [department]);

  const list = courses?.department === department ? courses.list : null;

  // After a department is picked, move on to its courses once they've loaded.
  useEffect(() => {
    if (list && focusCourse.current) {
      focusCourse.current = false;
      courseInput.current?.focus();
    }
  }, [list]);

  const departmentOptions = useMemo<ComboOption[]>(
    () =>
      (departments ?? []).map((d) => ({
        value: d.code,
        key: d.code,
        label: d.code,
        hint: d.name,
        display: `${d.code} · ${d.name}`,
        group: d.featured ? 'Information & Computer Sciences' : 'All departments',
      })),
    [departments],
  );

  const courseOptions = useMemo<ComboOption[]>(
    () =>
      (list ?? []).map((c) => ({
        value: c.code,
        key: c.number,
        label: c.number,
        hint: c.title,
        display: `${c.number} · ${c.title}`,
      })),
    [list],
  );

  const chooseDepartment = (code: string) => {
    setDepartment(code);
    focusCourse.current = true;
    onChange('');
  };

  return (
    <div className="course-picker">
      <div className="field">
        <span aria-hidden="true">Department</span>
        <Combobox
          label="Department"
          options={departmentOptions}
          value={department}
          onChange={chooseDepartment}
          placeholder={departments ? 'Type or choose, e.g. SWE' : 'Loading…'}
          disabled={!departments}
        />
      </div>
      <div className="field">
        <span aria-hidden="true">Course</span>
        <Combobox
          label="Course"
          options={courseOptions}
          value={value}
          onChange={onChange}
          placeholder={!department ? 'Pick a department first' : list ? 'Type or choose, e.g. 113' : 'Loading…'}
          disabled={!list}
          inputRef={courseInput}
        />
      </div>
      {error && (
        <p className="error course-picker-error" role="alert">
          Couldn’t load courses: {error}
        </p>
      )}
    </div>
  );
}
