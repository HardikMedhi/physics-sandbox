import * as THREE from 'three';

/** Unit sphere scaled to the ball radius, so radius changes need no new geometry. */
export function createBall(): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0x2f8fff, roughness: 0.35, metalness: 0.1 }),
  );
  ball.castShadow = true;
  ball.userData.selectId = 'ball';
  return ball;
}
