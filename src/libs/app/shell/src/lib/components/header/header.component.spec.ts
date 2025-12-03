import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { VERSION_SERVICE, IVersionService, AppVersion } from '@teensyrom-nx/domain';
import { of } from 'rxjs';
import '../../../test-setup';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    const mockVersionService: Partial<IVersionService> = {
      getVersion: () => of({ version: '1.0.0-test' } as AppVersion),
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [{ provide: VERSION_SERVICE, useValue: mockVersionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
