import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { createLifeFiles } from './files';

const disk = (name: string): string => readFileSync(`public/data/life-stories/${name}`, 'utf8');

/** A site's files answered from disk, but for those named as failing; and what was asked for. */
function site(failing: readonly string[] = []) {
  const asked: string[] = [];
  const notify = vi.fn<(message: string) => void>();
  const arrived = vi.fn<() => void>();
  const files = createLifeFiles({
    base: '/',
    fetchJson: (url) => {
      asked.push(url);
      const name = url.split('/').at(-1) ?? '';
      return failing.includes(name)
        ? Promise.resolve(new Response('', { status: 404 }))
        : Promise.resolve(new Response(disk(name)));
    },
    notify,
    arrived,
  });
  return { files, asked, notify, arrived };
}

describe('the files an animal’s story is told from', () => {
  it('asks for a group’s file once, says it is loading, then has it', async () => {
    const { files, asked, arrived } = site();
    expect(files.group('dinosaurs')).toBe('loading');
    expect(files.group('dinosaurs')).toBe('loading');
    await vi.waitFor(() => {
      expect(files.group('dinosaurs')).not.toBe('loading');
    });
    const data = files.group('dinosaurs');
    expect(typeof data === 'string' ? data : data.id).toBe('dinosaurs');
    expect(asked.filter((url) => url === '/data/life-stories/dinosaurs.json')).toHaveLength(1);
    expect(arrived).toHaveBeenCalled();
  });

  it('asks for the pictures and the doors with the first group, once', async () => {
    const { files, asked } = site();
    expect(files.pictures()).toBeNull();
    expect(files.doors()).toBeNull();
    await files.load('dinosaurs');
    await files.load('dinosaurs');
    await vi.waitFor(() => {
      expect(files.pictures()).not.toBeNull();
      expect(files.doors()).not.toBeNull();
    });
    expect(asked.filter((url) => url.endsWith('pictures.json'))).toHaveLength(1);
    expect(asked.filter((url) => url.endsWith('doors.json'))).toHaveLength(1);
  });

  it('loads every group for finding an animal in any', async () => {
    const { files } = site();
    expect((await files.all()).map((data) => data.id)).toEqual(['mammals', 'dinosaurs']);
  });

  it('says a group failed, tells the reader, and does not ask again', async () => {
    const { files, asked, notify } = site(['dinosaurs.json']);
    expect(files.group('dinosaurs')).toBe('loading');
    await vi.waitFor(() => {
      expect(files.group('dinosaurs')).toBe('failed');
    });
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('Could not load the animals’ stories'),
    );
    expect(files.group('dinosaurs')).toBe('failed');
    expect(asked.filter((url) => url.endsWith('dinosaurs.json'))).toHaveLength(1);
    await expect(files.load('dinosaurs')).rejects.toThrow();
  });

  it('tells a story without the pictures or the doors when they fail, and says so', async () => {
    const { files, notify, arrived } = site(['pictures.json', 'doors.json']);
    await files.load('dinosaurs');
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('the animals’ pictures'));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('the continents’ doors'));
    expect(files.pictures()).toBeNull();
    expect(files.doors()).toBeNull();
    expect(arrived).toHaveBeenCalled();
  });
});
