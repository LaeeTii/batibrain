import React, { useMemo, useState } from 'react';
import { RoomCanvas } from '../components/RoomCanvas';
import type { Vertex } from '../../../shared/src/types';
import { angleAtVertexDegrees, centroid, wallsFromVertices } from '../../../shared/src/geometry';

const initialVertices: Vertex[] = [
  { id: 'v0', pieceId: 'piece_demo', order: 0, x: 100, y: 100 },
  { id: 'v1', pieceId: 'piece_demo', order: 1, x: 520, y: 100 },
  { id: 'v2', pieceId: 'piece_demo', order: 2, x: 520, y: 280 },
  { id: 'v3', pieceId: 'piece_demo', order: 3, x: 320, y: 280 },
  { id: 'v4', pieceId: 'piece_demo', order: 4, x: 320, y: 500 },
  { id: 'v5', pieceId: 'piece_demo', order: 5, x: 100, y: 500 },
];

export function RoomEditorDemo() {
  const [vertices, setVertices] = useState<Vertex[]>(initialVertices);
  const [selectedWallIndex, setSelectedWallIndex] = useState<number | null>(null);

  const walls = useMemo(() => wallsFromVertices(vertices), [vertices]);
  const selectedWall = selectedWallIndex === null ? null : walls[selectedWallIndex] ?? null;
  const center = useMemo(() => centroid(vertices), [vertices]);

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#24292f' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>Prototype — éditeur de pièce polygonale</h1>
        <p style={{ marginTop: 0, color: '#57606a' }}>
          Base de départ pour le MVP : vue de dessus, sélection de mur, métriques automatiques.
        </p>
      </header>

      <RoomCanvas
        vertices={vertices}
        selectedWallIndex={selectedWallIndex}
        onVerticesChange={setVertices}
        onWallSelect={setSelectedWallIndex}
      />

      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Mur sélectionné</h3>
          {selectedWall ? (
            <>
              <p><strong>Index :</strong> {selectedWall.index + 1}</p>
              <p><strong>Départ :</strong> ({selectedWall.start.x}, {selectedWall.start.y})</p>
              <p><strong>Fin :</strong> ({selectedWall.end.x}, {selectedWall.end.y})</p>
              <p><strong>Longueur :</strong> {(selectedWall.lengthCm / 100).toFixed(2)} m</p>
            </>
          ) : (
            <p style={{ color: '#57606a' }}>Clique sur un mur pour voir ses informations.</p>
          )}
        </div>

        <div style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 16, background: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Angles calculés</h3>
          <ul>
            {vertices.map((vertex, index) => {
              const prev = vertices[(index - 1 + vertices.length) % vertices.length];
              const next = vertices[(index + 1) % vertices.length];
              return (
                <li key={vertex.id}>
                  v{index} — {angleAtVertexDegrees(prev, vertex, next).toFixed(1)}°
                </li>
              );
            })}
          </ul>
          <p style={{ color: '#57606a' }}>
            Centre géométrique : ({center.x.toFixed(0)}, {center.y.toFixed(0)})
          </p>
        </div>
      </section>
    </main>
  );
}
