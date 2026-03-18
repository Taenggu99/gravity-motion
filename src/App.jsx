import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { Rocket, Globe2, Magnet, PlusCircle, Eraser } from 'lucide-react';

const App = () => {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const mouseConstraintRef = useRef(null);

  // 버튼 상태
  const [activeTool, setActiveTool] = useState('create'); // 'create', 'delete'
  const [gravityMode, setGravityMode] = useState('earth'); // 'zero', 'earth'
  const [magnetActive, setMagnetActive] = useState(false);
  const [shapeCount, setShapeCount] = useState(0); // 도형 개수

  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    // 엔진 설정
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 } // 기본 중력 (지구)
    });
    engineRef.current = engine;
    const world = engine.world;

    // 렌더 설정
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio
      }
    });
    renderRef.current = render;

    // 랜덤 색상 목록
    const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981'];

    // 경계 벽 생성
    const walls = [
      Matter.Bodies.rectangle(window.innerWidth / 2, -1500, window.innerWidth * 2, 3000, { isStatic: true, render: { visible: false } }), // 위쪽 벽
      Matter.Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 50, window.innerWidth * 2, 100, {
        isStatic: true,
        render: { fillStyle: 'rgba(255, 255, 255, 0.05)' }
      }), // 아래쪽 벽
      Matter.Bodies.rectangle(-25, window.innerHeight / 2, 50, window.innerHeight * 2, { isStatic: true, render: { visible: false } }), // 왼쪽 벽
      Matter.Bodies.rectangle(window.innerWidth + 25, window.innerHeight / 2, 50, window.innerHeight * 2, { isStatic: true, render: { visible: false } }) // 오른쪽 벽
    ];

    Matter.World.add(world, walls);

    // 마우스 제어 설정
    const mouse = Matter.Mouse.create(render.canvas);

    // 맥 Retina / 고해상도 화면 좌표 보정
    mouse.pixelRatio = window.devicePixelRatio;

    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });
    mouseConstraintRef.current = mouseConstraint;

    Matter.World.add(world, mouseConstraint);
    render.mouse = mouse;

    // 캔버스 클릭 이벤트 (정확한 좌표 사용)
    const handleCanvasMousedown = (e) => {
      const currentTool = document.body.getAttribute('data-tool');
      const currentGravity = document.body.getAttribute('data-gravity');

      // 실제 화면 클릭 좌표
      const x = e.clientX;
      const y = e.clientY;

      if (currentTool === 'create') {
        // 도형 생성
        const radius = Math.random() * 25 + 15;
        const type = Math.random();
        const color = colors[Math.floor(Math.random() * colors.length)];

        let body;
        const options = {
          restitution: 0.8,
          friction: 0.005,
          render: {
            fillStyle: color,
            strokeStyle: 'rgba(255, 255, 255, 0.4)',
            lineWidth: 2
          }
        };

        if (type > 0.6) {
          body = Matter.Bodies.circle(x, y, radius, options);
        } else if (type > 0.3) {
          body = Matter.Bodies.rectangle(x, y, radius * 2, radius * 2, { ...options, chamfer: { radius: 8 } });
        } else {
          const sides = Math.floor(Math.random() * 4) + 3;
          body = Matter.Bodies.polygon(x, y, sides, radius * 1.3, options);
        }

        // 무중력일 때 공기 저항 증가
        if (currentGravity === 'zero') {
          body.frictionAir = 0.05;
        }

        Matter.World.add(world, body);
        setShapeCount(prev => prev + 1); // 도형 개수 증가

      } else if (currentTool === 'delete') {
        // 도형 삭제
        const allBodies = Matter.Composite.allBodies(world);
        const dynamicBodies = allBodies.filter(b => !b.isStatic);

        const mousePoint = { x: e.clientX, y: e.clientY };
        const clickedBodies = Matter.Query.point(dynamicBodies, mousePoint);

        if (clickedBodies.length > 0) {
          Matter.World.remove(world, clickedBodies[0]);
          setShapeCount(prev => Math.max(0, prev - 1)); // 도형 개수 감소
        }
      }
    };

    render.canvas.addEventListener('mousedown', handleCanvasMousedown);

    // 마우스 위치 추적 (자석 기능용)
    render.canvas.addEventListener('mousemove', (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    });

    // 엔진 및 렌더 시작
    Matter.Runner.run(Matter.Runner.create(), engine);
    Matter.Render.run(render);

    // 화면 크기 변경 대응
    const handleResize = () => {
      render.canvas.width = window.innerWidth;
      render.canvas.height = window.innerHeight;

      Matter.Body.setPosition(walls[1], { x: window.innerWidth / 2, y: window.innerHeight + 50 }); // 아래 벽
      Matter.Body.setPosition(walls[3], { x: window.innerWidth + 25, y: window.innerHeight / 2 }); // 오른쪽 벽
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (render.canvas) {
        render.canvas.removeEventListener('mousedown', handleCanvasMousedown);
      }
      Matter.Render.stop(render);
      Matter.Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
    };
  }, []);

  // 상태를 DOM에 동기화 (Matter.js에서 사용)
  useEffect(() => {
    document.body.setAttribute('data-tool', activeTool);
  }, [activeTool]);

  useEffect(() => {
    document.body.setAttribute('data-gravity', gravityMode);
  }, [gravityMode]);

  // 자석 기능 물리 적용
  useEffect(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    const applyMagnetForce = () => {
      if (!magnetActive) return;

      const bodies = Matter.Composite.allBodies(engine.world);
      bodies.forEach(body => {
        if (!body.isStatic) {
          const dx = mousePos.current.x - body.position.x;
          const dy = mousePos.current.y - body.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 1200 && distance > 10) {
            const forceMagnitude = (0.005 * body.mass) / (distance * 0.02);
            Matter.Body.applyForce(body, body.position, {
              x: (dx / distance) * forceMagnitude,
              y: (dy / distance) * forceMagnitude
            });
          }
        }
      });
    };

    Matter.Events.on(engine, 'beforeUpdate', applyMagnetForce);
    return () => Matter.Events.off(engine, 'beforeUpdate', applyMagnetForce);
  }, [magnetActive]);

  // 중력 변경 처리
  useEffect(() => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    switch (gravityMode) {
      case 'zero':
        engine.gravity.scale = 0;
        Matter.Composite.allBodies(engine.world).forEach(body => {
          if (!body.isStatic) body.frictionAir = 0.05;
        });
        break;
      case 'earth':
      default:
        engine.gravity.scale = 0.001;
        Matter.Composite.allBodies(engine.world).forEach(body => {
          if (!body.isStatic) body.frictionAir = 0.001;
        });
        break;
    }
  }, [gravityMode]);

  // 커서 스타일 설정
  const getCursorStyle = () => {
    if (activeTool === 'create') return 'crosshair';
    if (activeTool === 'delete') return 'cell';
    return 'default';
  };

  return (
    <>
      <div className="app-header">
        <h1 className="app-title">Gravity Sandbox</h1>
      </div>

      {shapeCount === 0 && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          padding: '16px 24px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.72)',
          color: 'white',
          fontSize: '20px',
          fontWeight: 600,
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          화면을 클릭하여 도형을 생성하세요.
        </div>
      )}

      <div ref={sceneRef} className="canvas-container" style={{ cursor: getCursorStyle() }} />

      <div className="controls-panel">
        <div className="controls-group">
          <span className="controls-title">마우스 동작</span>
          <div className="buttons-row">
            <button className={`control-btn ${activeTool === 'create' ? 'active' : ''}`} onClick={() => setActiveTool('create')}>
              <PlusCircle size={18} /> 생성
            </button>
            <button className={`control-btn ${activeTool === 'delete' ? 'active' : ''}`} onClick={() => setActiveTool('delete')}>
              <Eraser size={18} /> 삭제
            </button>
          </div>
        </div>

        <div className="controls-group">
          <span className="controls-title">특수 능력</span>
          <div className="buttons-row">
            <button className={`control-btn magnet-btn ${magnetActive ? 'active' : ''}`} onClick={() => setMagnetActive(!magnetActive)}>
              <Magnet size={18} /> 자석 {magnetActive ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="controls-group" style={{ borderRight: 'none' }}>
          <span className="controls-title">중력 환경</span>
          <div className="buttons-row">
            <button className={`control-btn ${gravityMode === 'zero' ? 'active' : ''}`} onClick={() => setGravityMode('zero')}>
              <Rocket size={18} /> 무중력
            </button>
            <button className={`control-btn ${gravityMode === 'earth' ? 'active' : ''}`} onClick={() => setGravityMode('earth')}>
              <Globe2 size={18} /> 중력
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;