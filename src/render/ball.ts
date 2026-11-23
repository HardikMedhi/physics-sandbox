import * as THREE from 'three';

export function createBall(radius: number): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0x2f8fff, roughness: 0.35, metalness: 0.1 }),
  );
  ball.castShadow = true;
  return ball;
}
